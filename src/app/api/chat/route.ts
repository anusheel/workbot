import {
  type ToolSet,
  type UIMessage,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { after } from "next/server";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { userOf } from "@/lib/auth";
import { chatToolsFor } from "@/lib/chat";
import { modelFor } from "@/lib/routing";
import { learn, prepare } from "@/lib/assistant";
import { textOf } from "@/lib/context";
import { historyOf, saveHistory } from "@/lib/history";
import { promptOf } from "@/lib/prompts";
import { allow } from "@/lib/rate-limit";
import { systemPrompt } from "@/lib/system-prompt";
import { withTrace } from "@/lib/tracing";
import { visitorId } from "@/lib/visitor";
import { ChatBody } from "./types";

// A tool loop on the large model can outlast a serverless function's default limit.
export const maxDuration = 60;

// What the person reads when every model in the chain has failed: a sentence, not the provider's error.
const unavailable =
  "WorkBot cannot reach its model right now. Try again in a minute.";

export async function POST(request: Request) {
  const visitor = await visitorId();
  // A caller without a cookie (the API reached directly) is limited by its address instead.
  const address =
    visitor ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (!allow(address ?? "anonymous"))
    return Response.json(
      { error: "Too many messages in a short time; try again in a minute." },
      { status: 429 },
    );
  const body = ChatBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  // A signed-in employee gets the tools their role reaches; anyone else, the customer set.
  const user = await userOf(request.headers);
  const role = user?.role ?? "public";
  const tools = chatToolsFor(role);
  const validated = await safeValidateUIMessages({
    messages: body.data.messages,
    tools,
  });
  if (!validated.success)
    return Response.json({ error: validated.error.message }, { status: 400 });
  const person = user?.id ?? visitor;
  const caller = person ?? "web";
  // The server's copy is the conversation: it holds what was said on other channels since this browser last saw it.
  const stored = person ? await historyOf(body.data.id, person) : undefined;
  const history = stored
    ? [...stored.messages, validated.data.at(-1)!]
    : validated.data;
  const prompt = await promptOf("workbot/system", caller, systemPrompt);
  return withTrace(
    {
      caller,
      name: "chat",
      role,
      user: user?.id,
      prompt: `workbot/system@${prompt.version}`,
    },
    () => reply(body.data.id, history, person, prompt.text, tools),
  );
}

async function reply(
  conversationId: string,
  history: UIMessage[],
  person: string | undefined,
  prompt: string,
  tools: ToolSet,
) {
  const { instructions, messages, memories, question } = await prepare({
    history,
    person,
    prompt,
  });
  await track("question_asked", { conversationId });
  const result = streamText({
    model: modelFor("chat"),
    instructions,
    messages,
    tools,
    stopWhen: isStepCount(8),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      onError: () => unavailable,
      // Once the reply is out, keep the conversation where every channel can continue it, and what it taught about the person.
      onEnd: ({ responseMessage }) => {
        const reply = textOf(responseMessage);
        // A turn that failed taught nothing.
        if (!person || !reply) return;
        after(async () => {
          await saveHistory(conversationId, person, [
            ...history,
            responseMessage,
          ]);
          await learn(person, { user: question, assistant: reply }, memories);
        });
      },
    }),
  });
}

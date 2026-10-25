import {
  type ToolSet,
  type UIMessage,
  convertToModelMessages,
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
import { compact, textOf } from "@/lib/context";
import {
  extractMemories,
  listMemories,
  memoryNote,
  remember,
} from "@/lib/memory";
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
  const caller = user?.id ?? visitor ?? "web";
  const prompt = await promptOf("workbot/system", caller, systemPrompt);
  return withTrace(
    { caller, name: "chat", role, prompt: `workbot/system@${prompt.version}` },
    () =>
      reply(
        body.data.id,
        validated.data,
        user?.id ?? visitor,
        prompt.text,
        tools,
      ),
  );
}

async function reply(
  conversationId: string,
  input: UIMessage[],
  visitor: string | undefined,
  prompt: string,
  tools: ToolSet,
) {
  const [memories, { messages, summary }] = await Promise.all([
    visitor ? listMemories(visitor) : [],
    // A summary the model could not write is left out; the answer still goes, and the trace holds why.
    compact(input, modelFor("summarize")).catch(() => compact(input)),
  ]);

  await track("question_asked", { conversationId });
  // What is known about this person and this conversation; empty on a first message, and an empty block is rejected.
  const known = [
    memoryNote(memories),
    summary && `Earlier in this conversation: ${summary}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const result = streamText({
    model: modelFor("chat"),
    // The prompt is the same for everyone and goes first, so the provider can serve it from its cache.
    instructions: [
      {
        role: "system",
        content: prompt,
        providerOptions: { anthropic: { cacheControl: { type: "ephemeral" } } },
      },
      ...(known ? [{ role: "system" as const, content: known }] : []),
    ],
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(8),
  });

  const question = textOf(messages.at(-1)!);
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools,
      onError: () => unavailable,
      // Once the reply is out, keep what this exchange taught about the person.
      onEnd: ({ responseMessage }) => {
        const reply = textOf(responseMessage);
        // A turn that failed taught nothing.
        if (!visitor || !reply) return;
        after(async () => {
          const found = await extractMemories(
            modelFor("extract"),
            { user: question, assistant: reply },
            memories,
          );
          for (const { kind, text } of found)
            await remember(visitor, kind, text);
        });
      },
    }),
  });
}

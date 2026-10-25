import {
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
import { chatTools } from "@/lib/chat";
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

export async function POST(request: Request) {
  const visitor = await visitorId();
  // A caller without a cookie (the API reached directly) is limited by its address instead.
  const caller =
    visitor ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  if (!allow(caller ?? "anonymous"))
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
  const validated = await safeValidateUIMessages({
    messages: body.data.messages,
    tools: chatTools,
  });
  if (!validated.success)
    return Response.json({ error: validated.error.message }, { status: 400 });
  const tenant = visitor ?? "web";
  const prompt = await promptOf("workbot/system", tenant, systemPrompt);
  return withTrace(
    { tenant, name: "chat", prompt: `workbot/system@${prompt.version}` },
    () => reply(body.data.id, validated.data, visitor, prompt.text),
  );
}

async function reply(
  conversationId: string,
  input: UIMessage[],
  visitor: string | undefined,
  prompt: string,
) {
  const [memories, { messages, summary }] = await Promise.all([
    visitor ? listMemories(visitor) : [],
    compact(input, modelFor("summarize")),
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
    tools: chatTools,
    stopWhen: isStepCount(8),
  });

  const question = textOf(messages.at(-1)!);
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      tools: chatTools,
      // Once the reply is out, keep what this exchange taught about the person.
      onEnd: ({ responseMessage }) => {
        if (!visitor) return;
        after(async () => {
          const found = await extractMemories(
            modelFor("extract"),
            { user: question, assistant: textOf(responseMessage) },
            memories,
          );
          for (const { kind, text } of found)
            await remember(visitor, kind, text);
        });
      },
    }),
  });
}

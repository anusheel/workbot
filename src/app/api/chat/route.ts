import {
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
import { chatModel, chatTools } from "@/lib/chat";
import { compact, textOf } from "@/lib/context";
import {
  extractMemories,
  listMemories,
  memoryNote,
  remember,
} from "@/lib/memory";
import { systemPrompt } from "@/lib/system-prompt";
import { visitorId } from "@/lib/visitor";
import { ChatBody } from "./types";

// A tool loop on the large model can outlast a serverless function's default limit.
export const maxDuration = 60;

export async function POST(request: Request) {
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
  const visitor = await visitorId();
  const [memories, { messages, summary }] = await Promise.all([
    visitor ? listMemories(visitor) : [],
    compact(validated.data, chatModel("small")),
  ]);

  await track("question_asked", { conversationId: body.data.id });
  const result = streamText({
    model: chatModel(),
    instructions: [
      systemPrompt,
      memoryNote(memories),
      summary && `Earlier in this conversation: ${summary}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
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
            chatModel("small"),
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

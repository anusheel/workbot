import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { chatModel, chatTools } from "@/lib/chat";
import { systemPrompt } from "@/lib/system-prompt";
import { ChatBody } from "./types";

export async function POST(request: Request) {
  const body = ChatBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  const messages = await safeValidateUIMessages({
    messages: body.data.messages,
    tools: chatTools,
  });
  if (!messages.success)
    return Response.json({ error: messages.error.message }, { status: 400 });

  await track("question_asked", { conversationId: body.data.id });
  const result = streamText({
    model: chatModel(),
    instructions: systemPrompt,
    messages: await convertToModelMessages(messages.data),
    tools: chatTools,
    stopWhen: isStepCount(8),
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, tools: chatTools }),
  });
}

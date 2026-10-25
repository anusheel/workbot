import { createTextStreamResponse, streamText, toTextStream } from "ai";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { catalog } from "@/lib/catalog";
import { chatModel } from "@/lib/chat";
import { requestSummary } from "@/lib/requests";
import { GenerateBody } from "./types";

// A page on the large model can outlast a serverless function's default limit.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = GenerateBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  const { prompt, currentSpec } = body.data;

  const data = await requestSummary();
  await track("page_generated");
  const result = streamText({
    model: chatModel(),
    instructions: [
      catalog.prompt(),
      "DATA: the company's live work requests, as JSON. Use these numbers as they are and never invent figures. Dates are ISO timestamps; show them as dates.",
      JSON.stringify(data),
      currentSpec?.root &&
        `CURRENT PAGE: the spec on screen. Change it as asked rather than starting over.\n${JSON.stringify(currentSpec)}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    prompt,
  });
  return createTextStreamResponse({
    stream: toTextStream({ stream: result.stream }),
  });
}

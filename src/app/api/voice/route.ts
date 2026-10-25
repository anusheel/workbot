import { z } from "zod";
import { track } from "@/lib/analytics";
import { chatModel } from "@/lib/chat";
import { withTrace } from "@/lib/tracing";
import { visitorId } from "@/lib/visitor";
import { voiceTurn } from "@/lib/voice";
import { VoiceBody } from "./types";

export async function POST(request: Request) {
  const body = VoiceBody.safeParse(await request.json().catch(() => null));
  if (!body.success)
    return Response.json(
      { error: z.flattenError(body.error) },
      { status: 400 },
    );
  const turn = await withTrace(
    { tenant: (await visitorId()) ?? "web", name: "voice" },
    () => voiceTurn(body.data.turns, chatModel("small")),
  );
  if (turn.request)
    await track("request_submitted", {
      requestId: turn.request.id,
      team: turn.request.team,
      priority: turn.request.priority,
      channel: "voice",
    });
  return Response.json(turn);
}

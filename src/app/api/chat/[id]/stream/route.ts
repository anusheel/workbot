import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { userOf } from "@/lib/auth";
import { resume } from "@/lib/resumable";
import { visitorId } from "@/lib/visitor";

// A reply is followed for at most a minute, which a function's limit allows.
export const maxDuration = 90;

/**
 * The reply still streaming in a conversation, for its person: replayed from
 * its start and followed to its end, the way the browser reconnects after a
 * reload. Nothing under way answers 204.
 */
export async function GET(
  request: Request,
  ctx: RouteContext<"/api/chat/[id]/stream">,
) {
  const person = (await userOf(request.headers))?.id ?? (await visitorId());
  const stream = person && (await resume((await ctx.params).id, person));
  if (!stream) return new Response(null, { status: 204 });
  return new Response(stream.pipeThrough(new TextEncoderStream()), {
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}

import { z } from "zod";
import { config } from "@/lib/config";
import { updateStatus } from "@/lib/outbound";
import { verifiedParams } from "@/lib/twilio";
import { StatusUpdate } from "./types";

/** Twilio reports each sent message's progress here: queued, sent, delivered, read, undelivered or failed. */
export async function POST(request: Request) {
  const token = config.twilio.authToken;
  if (!token) return new Response(null, { status: 404 });
  const params = await verifiedParams(request, token);
  if (!params) return new Response(null, { status: 403 });
  const update = StatusUpdate.safeParse(params);
  if (!update.success)
    return Response.json(z.flattenError(update.error), { status: 400 });
  const { MessageSid, MessageStatus, ErrorCode } = update.data;
  await updateStatus(MessageSid, MessageStatus, ErrorCode);
  return new Response(null, { status: 204 });
}

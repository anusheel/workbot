import { z } from "zod";
import { inngest } from "@/inngest/client";
import { messageReceived } from "@/inngest/events";
import { config } from "@/lib/config";
import { verifiedParams } from "@/lib/twilio";
import { IncomingMessage } from "./types";

/**
 * Twilio's webhook for an SMS or a WhatsApp message: the signature checked,
 * the message handed to the workflow, and an empty TwiML answer returned at
 * once, which is all Twilio needs. The reply goes out through the API when
 * the assistant has it; a redelivery of the same message is the same run.
 */
export async function POST(request: Request) {
  const token = config.twilio.authToken;
  if (!token) return new Response(null, { status: 404 });
  const params = await verifiedParams(request, token);
  if (!params) return new Response(null, { status: 403 });
  const message = IncomingMessage.safeParse(params);
  if (!message.success)
    return Response.json(z.flattenError(message.error), { status: 400 });
  const { MessageSid: sid, From: from, Body: text } = message.data;
  const whatsapp = from.startsWith("whatsapp:");
  await inngest.send(
    messageReceived.create(
      {
        channel: whatsapp ? "whatsapp" : "sms",
        address: from.replace(/^whatsapp:/, ""),
        text,
        sid,
      },
      { id: sid },
    ),
  );
  return new Response("<Response/>", {
    headers: { "content-type": "text/xml" },
  });
}

import { z } from "zod";

/** What Twilio posts for an incoming SMS or WhatsApp message, of the fields WorkBot reads; a WhatsApp sender's number starts with "whatsapp:". */
export const IncomingMessage = z.object({
  MessageSid: z.string().min(1),
  From: z.string().min(1),
  Body: z.string().default(""),
});

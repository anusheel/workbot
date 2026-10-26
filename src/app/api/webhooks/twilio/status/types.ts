import { z } from "zod";

/** What Twilio posts as a sent message moves: its id, its status, and an error code when it failed. */
export const StatusUpdate = z.object({
  MessageSid: z.string().min(1),
  MessageStatus: z.string().min(1),
  ErrorCode: z.string().optional(),
});

import { eventType } from "inngest";
import { z } from "zod";

/** A document landed in the inbox; its bytes are in the database under `id`. */
export const documentReceived = eventType("document/received", {
  schema: z.object({ id: z.uuid() }),
});

/** A reviewer answered: the workflow waiting on `id` goes on with the decision, and any corrected fields. */
export const documentReviewed = eventType("document/reviewed", {
  schema: z.object({
    id: z.uuid(),
    decision: z.enum(["approved", "rejected"]),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
});

/** Runs the daily reminders on demand. */
export const remindersRequested = eventType("reminders/requested");

/** Pulls what changed into the one shape, on demand. */
export const syncRequested = eventType("sync/requested");

/** A message came in on a text channel; the event's id is the provider's, so a redelivery is one run. */
export const messageReceived = eventType("channel/message.received", {
  schema: z.object({
    channel: z.enum(["sms", "whatsapp"]),
    address: z.string(),
    text: z.string(),
    sid: z.string(),
  }),
});

/** Runs the hourly checks on demand. */
export const watchRequested = eventType("watch/requested");

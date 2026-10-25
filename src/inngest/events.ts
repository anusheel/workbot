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

import { z } from "zod";

/** A message as it arrives from a channel: email, a form, a chat. */
export const IntakeBody = z.object({
  message: z.string().trim().min(10).max(10_000),
});
export type IntakeBody = z.infer<typeof IntakeBody>;

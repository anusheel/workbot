import { z } from "zod";

/** A conversation as the server keeps it, for the person it belongs to: its messages as the web renders them, each with the channel it came by. */
export const ConversationResponse = z.object({
  messages: z.array(
    z.looseObject({
      id: z.string(),
      role: z.enum(["system", "user", "assistant"]),
      parts: z.array(z.looseObject({ type: z.string() })),
      metadata: z.object({ channel: z.string().optional() }).optional(),
    }),
  ),
});

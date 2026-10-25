import { z } from "zod";

/** What useChat posts: the conversation id and its messages, which the AI SDK validates in detail. */
export const ChatBody = z.object({
  id: z.string().min(1).max(200),
  messages: z.array(z.unknown()).max(200),
});
export type ChatBody = z.infer<typeof ChatBody>;

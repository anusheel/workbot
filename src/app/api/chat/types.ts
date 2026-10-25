import { z } from "zod";

/** What useChat posts: the conversation id and its messages, which the AI SDK validates in detail. */
export const ChatBody = z.object({
  id: z.string(),
  messages: z.array(z.unknown()),
});
export type ChatBody = z.infer<typeof ChatBody>;

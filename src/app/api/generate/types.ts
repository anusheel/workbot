import { z } from "zod";

/** What useUIStream posts: the request in words, and the page on screen when it is an edit. */
export const GenerateBody = z.object({
  prompt: z.string().trim().min(1).max(2_000),
  currentSpec: z
    .object({ root: z.string(), elements: z.record(z.string(), z.unknown()) })
    .partial()
    .optional(),
});
export type GenerateBody = z.infer<typeof GenerateBody>;

import { z } from "zod";
import { isPublic } from "@/lib/web";

/** A document as text or as a public page; files come as multipart form data under `document`. */
export const DocumentBody = z.union([
  z.object({ text: z.string().trim().min(10).max(50_000) }),
  z.object({
    url: z
      .url()
      .refine(
        (url) => URL.canParse(url) && isPublic(new URL(url)),
        "a public http or https address",
      ),
  }),
]);
export type DocumentBody = z.infer<typeof DocumentBody>;

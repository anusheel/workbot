import { z } from "zod";

/** Where a document sent in has got to: its status in the workflow, what it was read as, the fields to check, and the request it became. */
export const DocumentStatus = z.object({
  id: z.uuid(),
  status: z.string(),
  type: z.string().nullable(),
  review: z.array(z.string()),
  requestId: z.uuid().nullable(),
});

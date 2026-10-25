import { z } from "zod";
import { NewRequest, priorities, statuses, teams } from "@/lib/requests";

export { NewRequest as RequestBody };

export const RequestResponse = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  team: z.enum(teams),
  priority: z.enum(priorities),
  status: z.enum(statuses),
  createdAt: z.iso.datetime(),
});
export type RequestResponse = z.infer<typeof RequestResponse>;

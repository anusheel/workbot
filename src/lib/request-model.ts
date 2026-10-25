import { z } from "zod";

export const teams = ["operations", "finance", "support"] as const;
export const priorities = ["low", "normal", "high"] as const;
export const statuses = ["open", "in_progress", "done"] as const;
export type Team = (typeof teams)[number];
export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];

export const statusLabels: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export const NewRequest = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(5000).default(""),
  team: z.enum(teams),
  priority: z.enum(priorities).default("normal"),
});
export type NewRequest = z.infer<typeof NewRequest>;

export const RequestFilter = z.object({
  team: z.enum(teams).optional().catch(undefined),
  status: z.enum(statuses).optional().catch(undefined),
});
export type RequestFilter = z.infer<typeof RequestFilter>;

export const WorkRequest = NewRequest.extend({
  id: z.uuid(),
  status: z.enum(statuses),
  createdAt: z.date(),
});
export type WorkRequest = z.infer<typeof WorkRequest>;

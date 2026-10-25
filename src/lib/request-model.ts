import { z } from "zod";

/** A team is one of the customer's, which the configuration names; the model is built from that list. */
export type Team = string;
export const priorities = ["low", "normal", "high"] as const;
export const statuses = ["open", "in_progress", "done"] as const;
export type Priority = (typeof priorities)[number];
export type Status = (typeof statuses)[number];

export const statusLabels: Record<Status, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

/** A request as a client composes it, before the server checks the team against the customer's list. */
export const RequestDraft = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(5000).default(""),
  team: z.string().min(1),
  priority: z.enum(priorities).default("normal"),
});
export type NewRequest = z.infer<typeof RequestDraft>;

export type RequestFilter = { team?: Team; status?: Status };

export type WorkRequest = NewRequest & {
  id: string;
  status: Status;
  createdAt: Date;
};

/** The request schemas for a customer's teams: what may be filed, how a list is filtered, what a row is. */
export function requestModel(teams: readonly [string, ...string[]]) {
  const NewRequest = RequestDraft.extend({ team: z.enum(teams) });
  const RequestFilter = z.object({
    team: z.enum(teams).optional().catch(undefined),
    status: z.enum(statuses).optional().catch(undefined),
  });
  const WorkRequest = NewRequest.extend({
    id: z.uuid(),
    status: z.enum(statuses),
    createdAt: z.date(),
  });
  return { NewRequest, RequestFilter, WorkRequest };
}

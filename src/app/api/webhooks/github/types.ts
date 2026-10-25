import { z } from "zod";

/** What GitHub delivers for an issues event: the action, the issue as its API shows it, the repository. */
export const IssuesEvent = z.object({
  action: z.string(),
  issue: z.object({
    number: z.number().int(),
    title: z.string(),
    body: z.string().nullable(),
    state: z.string(),
    user: z.object({ login: z.string() }).optional(),
    assignees: z.array(z.object({ login: z.string() })).default([]),
    // A delivery carries label objects; the server's own read of an issue, names.
    labels: z
      .array(z.union([z.string(), z.object({ name: z.string() })]))
      .default([]),
    html_url: z.url(),
    updated_at: z.string(),
  }),
  repository: z.object({ full_name: z.string() }),
});
export type IssuesEvent = z.infer<typeof IssuesEvent>;

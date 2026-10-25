import { z } from "zod";
import data from "../../content/customer.json";

/**
 * The company the assistant works for, as configuration: its name, what it
 * is, its teams and what each files, where a document of each kind is filed,
 * and which sections of the knowledge base its customers may read. A new
 * customer is a new file, not a change to the code.
 */
export const Customer = z
  .object({
    name: z.string().min(1),
    assistant: z.string().min(1),
    about: z.string().min(1),
    teams: z
      .array(
        z.object({
          id: z.string().regex(/^[a-z]+$/, "a team id is one lowercase word"),
          files: z.string().min(1),
        }),
      )
      .min(1)
      .refine(
        (teams) => new Set(teams.map((t) => t.id)).size === teams.length,
        "team ids repeat",
      ),
    filing: z.object({
      invoice: z.string(),
      complaint: z.string(),
      other: z.string(),
    }),
    customerSections: z.array(z.string().min(1)).min(1),
  })
  .refine(
    (c) =>
      Object.values(c.filing).every((team) =>
        c.teams.some((t) => t.id === team),
      ),
    "filing names a team that does not exist",
  );
export type Customer = z.infer<typeof Customer>;

export const customer: Customer = Customer.parse(data);

/** "operations, finance and support". */
export const teamList = (c: Customer) => {
  const ids = c.teams.map((t) => t.id);
  return ids.length > 1
    ? `${ids.slice(0, -1).join(", ")} and ${ids.at(-1)}`
    : ids[0];
};

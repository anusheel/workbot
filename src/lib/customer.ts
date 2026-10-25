import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { config } from "./config";

/**
 * The company the assistant works for, as configuration: its name, what it
 * is, its teams and what each files, where a document of each kind is filed,
 * which sections of the knowledge base its customers may read, and what it
 * overrides in the product's defaults. A new customer is a new file in
 * content/customers, and `CUSTOMER` names the one a deployment serves.
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
    // Checked against the product's settings, which know the tasks and routes.
    settings: z.unknown().optional(),
  })
  .refine(
    (c) =>
      Object.values(c.filing).every((team) =>
        c.teams.some((t) => t.id === team),
      ),
    "filing names a team that does not exist",
  );
export type Customer = z.infer<typeof Customer>;

/** The customer's file, read once at startup. */
export function customerFile(id: string) {
  return path.join(process.cwd(), "content/customers", `${id}.json`);
}

export const customer: Customer = Customer.parse(
  JSON.parse(readFileSync(customerFile(config.customer), "utf8")),
);

/** "operations, finance and support". */
export const teamList = (c: Customer) => {
  const ids = c.teams.map((t) => t.id);
  return ids.length > 1
    ? `${ids.slice(0, -1).join(", ")} and ${ids.at(-1)}`
    : ids[0];
};

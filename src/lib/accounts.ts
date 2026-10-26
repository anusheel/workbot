import { z } from "zod";

/** An account on the target list: company-level facts only, each row with the pages that show them. */
export const Account = z.object({
  name: z.string().min(2),
  website: z.url(),
  state: z.string().length(2),
  category: z.enum([
    "lumber",
    "masonry",
    "roofing",
    "landscape",
    "plumbing",
    "electrical",
    "general",
  ]),
  locations: z.number().int().positive().nullable(),
  employees: z.string().nullable(),
  delivers: z.boolean().nullable(),
  contractorOrdering: z.boolean().nullable(),
  departments: z.boolean().nullable(),
  evidence: z.array(z.url()).min(1),
});
export type Account = z.infer<typeof Account>;

// The criteria, as code: what makes an account worth a first email, and by how
// much. An unknown fact scores nothing; the list asks for evidence, not hope.
export const criteria = [
  {
    name: "delivers to job sites",
    points: 3,
    met: (a: Account) => a.delivers === true,
  },
  {
    name: "takes contractors' orders by phone, text or email",
    points: 3,
    met: (a: Account) => a.contractorOrdering === true,
  },
  {
    name: "separate departments for orders, billing or service",
    points: 2,
    met: (a: Account) => a.departments === true,
  },
  {
    name: "more than one location",
    points: 2,
    met: (a: Account) => (a.locations ?? 0) > 1,
  },
];

/** An account's score out of 10, with the criteria it met. */
export function score(account: Account) {
  const met = criteria.filter((c) => c.met(account));
  return {
    score: met.reduce((sum, c) => sum + c.points, 0),
    reasons: met.map((c) => c.name),
  };
}

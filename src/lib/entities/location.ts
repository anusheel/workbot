// Generated from content/entities/location.json by pnpm generate. Edit the description, not this file.
import { z } from "zod";
import { query } from "@/lib/db";

/** Who may reach locations; the page and the route sit where the access says. */
export const locationAccess = "employee" as const;
export const locationKind = ["warehouse", "yard", "office"] as const;

export const NewLocation = z.object({
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(200),
  manager: z.string().trim().max(80).default(""),
  phone: z.string().trim().min(7).max(40).nullable().default(null),
  kind: z.enum(locationKind).default("warehouse"),
});
export type NewLocation = z.infer<typeof NewLocation>;

export const Location = NewLocation.extend({
  id: z.uuid(),
  createdAt: z.date(),
});
export type Location = z.infer<typeof Location>;

const columns = `id, name, address, manager, phone, kind, created_at as "createdAt"`;

export const listLocations = () =>
  query<Location>(`select ${columns} from locations order by created_at desc`);

export async function createLocation(input: NewLocation): Promise<Location> {
  const [row] = await query<Location>(
    `insert into locations (name, address, manager, phone, kind) values ($1, $2, $3, $4, $5) returning ${columns}`,
    [input.name, input.address, input.manager, input.phone, input.kind],
  );
  return row;
}

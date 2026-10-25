// Generated from content/entities/vendor.json by pnpm generate. Edit the description, not this file.
import { z } from "zod";
import { query } from "@/lib/db";

/** Who may reach vendors; the page and the route sit where the access says. */
export const vendorAccess = "employee" as const;
export const vendorTerms = ["net 15", "net 30", "net 60"] as const;

export const NewVendor = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().nullable().default(null),
  phone: z.string().trim().min(7).max(40).nullable().default(null),
  terms: z.enum(vendorTerms).default("net 30"),
  notes: z.string().trim().max(2000).default(""),
});
export type NewVendor = z.infer<typeof NewVendor>;

export const Vendor = NewVendor.extend({ id: z.uuid(), createdAt: z.date() });
export type Vendor = z.infer<typeof Vendor>;

const columns = `id, name, email, phone, terms, notes, created_at as "createdAt"`;

export const listVendors = () =>
  query<Vendor>(`select ${columns} from vendors order by created_at desc`);

export async function createVendor(input: NewVendor): Promise<Vendor> {
  const [row] = await query<Vendor>(
    `insert into vendors (name, email, phone, terms, notes) values ($1, $2, $3, $4, $5) returning ${columns}`,
    [input.name, input.email, input.phone, input.terms, input.notes],
  );
  return row;
}

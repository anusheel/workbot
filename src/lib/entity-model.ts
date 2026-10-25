import { z } from "zod";

/**
 * An entity as a description: what its fields are, what each must be, and
 * who may reach it. The generator turns one into the table, the model, the
 * route, the page and the tests, so a new entity is a new file here.
 */
export const Field = z
  .object({
    name: z
      .string()
      .regex(/^[a-z][a-zA-Z0-9]*$/, "a field name is a camelCase word"),
    label: z.string().min(1).optional(),
    type: z.enum(["text", "email", "phone", "number", "choice"]),
    required: z.boolean().default(false),
    max: z.number().int().positive().optional(),
    multiline: z.boolean().default(false),
    options: z.array(z.string().min(1)).min(1).optional(),
    default: z.string().optional(),
  })
  .refine((f) => f.type !== "choice" || f.options, "a choice names its options")
  .refine(
    (f) => !f.default || f.type !== "choice" || f.options?.includes(f.default),
    "a choice's default is one of its options",
  );
export type Field = z.infer<typeof Field>;

export const Entity = z
  .object({
    name: z.string().regex(/^[a-z]+$/, "an entity name is one lowercase word"),
    plural: z.string().regex(/^[a-z]+$/, "a plural is one lowercase word"),
    label: z.string().min(1),
    // Who may reach it: an employee entity lives under /admin, a customer one at the root. Day 30 puts the check behind the placement.
    access: z.enum(["employee", "customer"]).default("employee"),
    fields: z.array(Field).min(1),
  })
  .refine(
    (e) => e.fields.some((f) => f.required),
    "an entity has a required field",
  )
  .refine(
    (e) => new Set(e.fields.map((f) => f.name)).size === e.fields.length,
    "field names repeat",
  )
  .refine(
    (e) => !e.fields.some((f) => f.name === "id" || f.name === "createdAt"),
    "id and createdAt are the entity's own",
  );
export type Entity = z.infer<typeof Entity>;

import { z } from "zod";
import data from "../../content/rules.json";
import { teams } from "./requests";

/**
 * Rules are data: an ordered table of conditions and actions, applied to a
 * record before the model sees it. Anything with a right answer is a rule,
 * not a prompt, and every rule that fires is written on the record.
 */
const Condition = z
  .object({ field: z.string().min(1) })
  .and(
    z.union([
      z.object({ matches: z.string().min(1) }),
      z.object({ missing: z.literal(true) }),
      z.object({ over: z.number() }),
    ]),
  );
const Action = z.union([
  z.object({ set: z.record(z.string(), z.string()) }),
  z.object({ normalize: z.literal("phone") }),
  z.object({ companyFromEmail: z.literal(true) }),
  z.object({ flag: z.string().min(1) }),
]);
export const Rule = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  on: z.enum(["contact", "ticket", "invoice"]),
  when: z.array(Condition).min(1),
  then: Action,
});
export type Rule = z.infer<typeof Rule>;

const Rules = z
  .array(Rule)
  .refine((rules) => new Set(rules.map((r) => r.id)).size === rules.length, {
    message: "rule ids are unique",
  })
  .refine(
    (rules) =>
      rules.every(
        (r) =>
          !("set" in r.then) ||
          !r.then.set.team ||
          teams.includes(r.then.set.team),
      ),
    { message: "a rule routes to a team the customer has" },
  );

export const rules: Rule[] = Rules.parse(data);

export type Fields = Record<string, unknown>;
/** One rule's effect on one record: the field it changed, from what, to what. */
export type Applied = {
  rule: string;
  field: string;
  from: unknown;
  to: unknown;
};

/** A phone number as E.164, with North America assumed for 10 digits; anything shorter is left as written. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 7 ? `+${digits}` : raw;
}

/** A company name from an email's domain: the first label, hyphens as spaces, title case. */
export function companyFromEmail(email: string): string | null {
  const domain = email.split("@")[1];
  if (!domain) return null;
  return domain
    .split(".")[0]
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const holds = (condition: z.infer<typeof Condition>, record: Fields) => {
  const value = record[condition.field];
  if ("missing" in condition) return value == null || value === "";
  if ("over" in condition)
    return typeof value === "number" && value > condition.over;
  return (
    typeof value === "string" && new RegExp(condition.matches, "i").test(value)
  );
};

/** What an action changes, as field and new value; nothing when it would change nothing. */
function changes(action: Rule["then"], record: Fields): [string, unknown][] {
  if ("set" in action) return Object.entries(action.set);
  if ("normalize" in action) {
    const phone = record.phone;
    return typeof phone === "string" ? [["phone", normalizePhone(phone)]] : [];
  }
  if ("companyFromEmail" in action) {
    const email = record.email;
    return typeof email === "string"
      ? [["company", companyFromEmail(email)]]
      : [];
  }
  const flags = Array.isArray(record.flags) ? record.flags : [];
  return [["flags", [...flags, action.flag]]];
}

/** The rules for a kind of record, in order, each seeing the record as the ones before it left it. */
export function applyRules(
  on: Rule["on"],
  record: Fields,
): { record: Fields; applied: Applied[] } {
  const out = { ...record };
  const applied: Applied[] = [];
  for (const rule of rules.filter((r) => r.on === on)) {
    if (!rule.when.every((condition) => holds(condition, out))) continue;
    for (const [field, to] of changes(rule.then, out)) {
      if (JSON.stringify(out[field]) === JSON.stringify(to)) continue;
      applied.push({ rule: rule.id, field, from: out[field] ?? null, to });
      out[field] = to;
    }
  }
  return { record: out, applied };
}

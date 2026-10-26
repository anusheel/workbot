import { Badge } from "@/components/ui/badge";

type Props = {
  data: Record<string, unknown>;
  /** The schema's fields in its order; the database does not keep it. */
  order: string[];
  /** The fields a person should check: extracted with low confidence. */
  review: string[];
};

/** An extracted record as rows of field and value, in the schema's order, with the doubtful ones marked. */
export function DocumentFields({ data, order, review }: Props) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
      {order.map((field) => (
        <div key={field} className="contents">
          <dt className="flex items-start gap-2 text-muted-foreground">
            {label(field)}
            {review.includes(field) && <Badge variant="outline">Check</Badge>}
          </dt>
          <dd className="whitespace-pre-wrap">
            <Value value={data[field]} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

type Change = { kind: "insertion" | "deletion"; text: string };
const isChanges = (value: unknown): value is Change[] =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every((v) => v && typeof v === "object" && "kind" in v && "text" in v);

/** A value as text, except tracked changes, which read as they do in the document: inserted text underlined, deleted text struck through. */
function Value({ value }: { value: unknown }) {
  if (!isChanges(value)) return show(value);
  return (
    <ul className="flex flex-col gap-1">
      {value.map((change, i) => (
        <li key={i}>
          {change.kind === "insertion" ? (
            <ins className="text-emerald-700 dark:text-emerald-400">
              {change.text}
            </ins>
          ) : (
            <del className="text-destructive">{change.text}</del>
          )}
        </li>
      ))}
    </ul>
  );
}

const label = (field: string) =>
  field.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** A value as a person reads it: lists on lines, records as "name: value", nothing for null. */
export function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value))
    return value.length ? value.map(show).join("\n") : "—";
  if (typeof value === "object")
    return Object.entries(value)
      .map(([k, v]) => `${label(k)}: ${show(v)}`)
      .join(", ");
  return String(value);
}

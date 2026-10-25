import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { RequestFilter } from "@/lib/request-model";

// One link per value, as a row of buttons; the chosen one is filled in. Links,
// not controls, so the filters work without JavaScript and can be shared.
export function FilterRow({
  name,
  label,
  all,
  options,
  filter,
  labels = {},
}: {
  name: keyof RequestFilter;
  label: string;
  all: string;
  options: readonly string[];
  filter: RequestFilter;
  labels?: Record<string, string>;
}) {
  const href = (value?: string) => ({
    pathname: "/requests" as const,
    query: Object.fromEntries(
      Object.entries({ ...filter, [name]: value }).filter(([, v]) => v),
    ),
  });
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {[undefined, ...options].map((value) => {
        const chosen = filter[name] === value;
        return (
          <Button
            key={value ?? "all"}
            asChild
            size="sm"
            variant={chosen ? "secondary" : "ghost"}
            className="capitalize"
          >
            <Link href={href(value)} aria-current={chosen ? "page" : undefined}>
              {value ? (labels[value] ?? value) : all}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

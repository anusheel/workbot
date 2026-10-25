import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import {
  RequestFilter,
  listRequests,
  statusLabels,
  statuses,
  teams,
} from "@/lib/requests";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage(props: PageProps<"/requests">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </div>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Requests searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Requests({
  searchParams,
}: Pick<PageProps<"/requests">, "searchParams">) {
  const filter = RequestFilter.parse(await searchParams);
  return (
    <>
      <div className="mt-6 flex flex-col gap-2">
        <FilterRow name="team" options={teams} filter={filter} />
        <FilterRow
          name="status"
          options={statuses}
          filter={filter}
          labels={statusLabels}
        />
      </div>
      <div className="mt-6">
        <RequestList requests={await listRequests(filter)} />
      </div>
    </>
  );
}

// One link per value, as a row of buttons; the chosen one is filled in. Links,
// not controls, so the filters work without JavaScript and can be shared.
function FilterRow({
  name,
  options,
  filter,
  labels = {},
}: {
  name: keyof RequestFilter;
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
    <div className="flex flex-wrap gap-1">
      {[undefined, ...options].map((value) => (
        <Button
          key={value ?? "all"}
          asChild
          size="sm"
          variant={filter[name] === value ? "secondary" : "ghost"}
          className="capitalize"
        >
          <Link href={href(value)}>
            {value ? (labels[value] ?? value) : `All ${name}s`}
          </Link>
        </Button>
      ))}
    </div>
  );
}

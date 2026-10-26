import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FilterRow } from "@/components/filter-row";
import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import {
  RequestFilter,
  listRequests,
  statusLabels,
  statuses,
  teams,
} from "@/lib/requests";
import { requireUser } from "@/lib/auth";

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
  await requireUser();
  const filter = RequestFilter.parse(await searchParams);
  return (
    <>
      <div className="mt-6 flex flex-col gap-2">
        <FilterRow
          name="team"
          label="Team"
          all="All teams"
          options={teams}
          filter={filter}
        />
        <FilterRow
          name="status"
          label="Status"
          all="All statuses"
          options={statuses}
          filter={filter}
          labels={statusLabels}
        />
      </div>
      <div className="mt-6">
        <RequestList
          requests={await listRequests(filter, 100)}
          filtered={Boolean(filter.team || filter.status)}
          showCount
        />
      </div>
    </>
  );
}

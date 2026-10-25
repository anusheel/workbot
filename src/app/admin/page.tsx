import type { Metadata } from "next";
import { io } from "next/cache";
import Link from "next/link";
import { Suspense } from "react";
import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import { StatusCounts } from "@/components/status-counts";
import { requestSummary } from "@/lib/requests";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  // requestSummary queries before it reaches listRequests' io(), so without
  // this the build prerenders the page and needs a database.
  await io();
  const summary = await requestSummary();
  return (
    <>
      <div className="mt-8">
        <StatusCounts byStatus={summary.byStatus} />
      </div>
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Latest requests
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/requests">All requests</Link>
        </Button>
      </div>
      <div className="mt-3">
        <RequestList requests={summary.latest.slice(0, 5)} />
      </div>
    </>
  );
}

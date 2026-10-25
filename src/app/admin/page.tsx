import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listRequests, statusLabels, statuses } from "@/lib/requests";

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
  const requests = await listRequests();
  return (
    <>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {statuses.map((status) => (
          <Card key={status}>
            <CardHeader>
              <CardDescription>{statusLabels[status]}</CardDescription>
              <CardTitle className="text-3xl">
                {requests.filter((r) => r.status === status).length}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
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
        <RequestList requests={requests.slice(0, 5)} />
      </div>
    </>
  );
}

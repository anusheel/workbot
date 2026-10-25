import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RequestList } from "@/components/request-list";
import { Button } from "@/components/ui/button";
import { listRequests } from "@/lib/requests";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Requests</h1>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </div>
      <div className="mt-8">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
        >
          <Requests />
        </Suspense>
      </div>
    </main>
  );
}

async function Requests() {
  return <RequestList requests={await listRequests()} />;
}

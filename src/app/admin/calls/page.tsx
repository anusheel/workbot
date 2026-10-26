import type { Metadata } from "next";
import { Suspense } from "react";
import { LiveCalls } from "@/components/live-calls";
import { permits, requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { customer } from "@/lib/customer";

export const metadata: Metadata = { title: "Calls" };

export default function CallsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Calls</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Voice calls as they happen, through the realtime server. An agent can
        say something to the caller; it appears on their screen.
      </p>
      <div className="mt-8">
        <Suspense
          fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
        >
          <Calls />
        </Suspense>
      </div>
    </>
  );
}

async function Calls() {
  const user = await requireUser();
  const url = config.realtime.url;
  if (!url)
    return (
      <p className="text-sm text-muted-foreground">
        No realtime server is configured (REALTIME_URL).
      </p>
    );
  return (
    <LiveCalls
      url={url}
      assistant={customer.assistant}
      canSpeak={permits(user.role, "agent")}
    />
  );
}

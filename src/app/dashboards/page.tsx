import type { Metadata } from "next";
import { Generator } from "@/components/generator";
import { customer } from "@/lib/customer";
import { Suspense } from "react";
import { SignedIn } from "@/components/allowed";

export const metadata: Metadata = { title: "Dashboards" };

export default function DashboardsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Describe a dashboard, a form or a timeline, and {customer.assistant}{" "}
        builds it from the live request data.
      </p>
      <Suspense>
        <SignedIn>
          <div className="mt-8">
            <Generator />
          </div>
        </SignedIn>
      </Suspense>
    </main>
  );
}

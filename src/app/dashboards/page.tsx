import type { Metadata } from "next";
import { Generator } from "@/components/generator";

export const metadata: Metadata = { title: "Dashboards" };

export default function DashboardsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboards</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Describe a dashboard, a form or a timeline, and WorkBot builds it from
        the live request data.
      </p>
      <div className="mt-8">
        <Generator />
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { priorities, teams } from "@/lib/requests";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "New request" };

export default function NewRequestPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <div className="max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">New request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe what you need and which team should pick it up.
        </p>
        <div className="mt-8">
          <RequestForm teams={teams} priorities={priorities} />
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { MemoryList } from "@/components/memory-list";
import { listMemories } from "@/lib/memory";
import { visitorId } from "@/lib/visitor";
import { forgetEverything, forgetMemory } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <h2 className="mt-10 text-sm font-medium text-muted-foreground">
          Memory
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What WorkBot has learned about you from your conversations. It uses
          this to answer better, and forgets anything you ask it to.
        </p>
        <div className="mt-6">
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
          >
            <Memories />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function Memories() {
  const visitor = await visitorId();
  const memories = visitor ? await listMemories(visitor) : [];
  return (
    <MemoryList
      memories={memories}
      onForget={forgetMemory}
      onForgetAll={forgetEverything}
    />
  );
}

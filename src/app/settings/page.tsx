import type { Metadata } from "next";
import { Suspense } from "react";
import { Unplug } from "lucide-react";
import { MemoryList } from "@/components/memory-list";
import { PendingButton } from "@/components/pending-button";
import { currentUser } from "@/lib/auth";
import { connections } from "@/lib/credentials";
import { customer } from "@/lib/customer";
import { when } from "@/lib/format";
import { listMemories } from "@/lib/memory";
import { memoryOwner } from "@/lib/visitor";
import { disconnect, forgetEverything, forgetMemory } from "./actions";
import { ConnectGitHub } from "./connect-form";

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
          What {customer.assistant} has learned about you from your
          conversations. It uses this to answer better, and forgets anything you
          ask it to.
        </p>
        <div className="mt-6">
          <Suspense
            fallback={<p className="text-sm text-muted-foreground">Loading…</p>}
          >
            <Memories />
          </Suspense>
        </div>
        <Suspense>
          <Connections />
        </Suspense>
      </div>
    </main>
  );
}

async function Memories() {
  const visitor = await memoryOwner();
  const memories = visitor ? await listMemories(visitor) : [];
  return (
    <MemoryList
      memories={memories}
      onForget={forgetMemory}
      onForgetAll={forgetEverything}
    />
  );
}

/** A signed-in user's own integration tokens: connected here, sealed at rest, used for the work done in their name. */
async function Connections() {
  const user = await currentUser();
  if (!user) return null;
  const [github] = await connections(user.id);
  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium text-muted-foreground">Connections</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        With your own GitHub token, the tickets {customer.assistant} files and
        comments on are filed as you. The token is sealed before it is stored
        and opened only for the call that needs it.
      </p>
      <div className="mt-6 rounded-xl border p-4">
        {github ? (
          <form
            action={disconnect}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm">
              GitHub connected, sealed {when(github.sealedAt)}
            </span>
            <PendingButton busy="Disconnecting…" icon={<Unplug />}>
              Disconnect
            </PendingButton>
          </form>
        ) : (
          <ConnectGitHub />
        )}
      </div>
    </section>
  );
}

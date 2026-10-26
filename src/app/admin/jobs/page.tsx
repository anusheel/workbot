import { RotateCcw, Send } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { permits, requireUser } from "@/lib/auth";
import { deadLetterCounts, listDeadLetters } from "@/lib/dead-letters";
import { consumerLag, recentEvents } from "@/lib/events";
import { when } from "@/lib/format";
import { dispatchNow, replay } from "./actions";

export const metadata: Metadata = { title: "Jobs" };

export default function JobsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Jobs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Work that runs off the request: each sender gets a fair share of the
        workers, a failure is retried with backoff, and what still fails waits
        here for a person. The domain events below are read by their consumers
        in order, each from where it left off.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Sections />
      </Suspense>
    </>
  );
}

async function Sections() {
  const user = await requireUser();
  const admin = permits(user.role, "admin");
  const [letters, counts, lag, events] = await Promise.all([
    listDeadLetters(12),
    deadLetterCounts(),
    consumerLag(),
    recentEvents(8),
  ]);
  return (
    <>
      <section className="mt-10">
        <h2 className="text-base font-semibold">Dead letters</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {counts.length === 0
            ? "Nothing is waiting."
            : counts
                .map(
                  (c) => `${c.count} from ${c.owner ?? "no one"} (${c.source})`,
                )
                .join(" · ")}
        </p>
        {letters.length > 0 && (
          <div className="mt-3 rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">When</TableHead>
                  {admin && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {letters.map((letter) => (
                  <TableRow key={letter.id}>
                    <TableCell className="font-mono text-xs">
                      {letter.source}
                    </TableCell>
                    <TableCell className="max-w-32 truncate">
                      {letter.owner ?? "—"}
                    </TableCell>
                    <TableCell
                      className="max-w-72 truncate text-muted-foreground"
                      title={letter.error}
                    >
                      {letter.error}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {when(letter.createdAt)}
                    </TableCell>
                    {admin && (
                      <TableCell className="text-right">
                        {letter.replayedAt ? (
                          <Badge variant="outline">Sent back</Badge>
                        ) : (
                          <form>
                            <PendingButton
                              formAction={replay.bind(null, letter.id)}
                              busy="Sending…"
                              icon={<RotateCcw />}
                            >
                              Send back
                            </PendingButton>
                          </form>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">Event consumers</h2>
          {admin && (
            <form>
              <PendingButton
                formAction={dispatchNow}
                busy="Dispatching…"
                icon={<Send />}
              >
                Dispatch now
              </PendingButton>
            </form>
          )}
        </div>
        <div className="mt-3 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consumer</TableHead>
                <TableHead className="text-right">Read up to</TableHead>
                <TableHead className="text-right">Behind</TableHead>
                <TableHead className="text-right">Failures here</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lag.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.position}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.behind}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.failures}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="mt-4 divide-y rounded-xl border text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">
                {e.id}
              </span>
              <span className="font-mono text-xs">
                {e.topic} v{e.version}
              </span>
              <span className="flex-1 truncate text-muted-foreground">
                {e.key}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {when(e.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

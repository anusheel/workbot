import { RefreshCw } from "lucide-react";
import type { Metadata } from "next";
import { io } from "next/cache";
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
import { when } from "@/lib/format";
import { githubEnabled } from "@/lib/github";
import { lastSync, listTickets } from "@/lib/tickets";
import { syncNow } from "./actions";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The ticketing system&apos;s issues in one shape, pulled every 15
        minutes; the assistant finds them here and writes through the system.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Tickets />
      </Suspense>
    </>
  );
}

async function Tickets() {
  await io();
  if (!githubEnabled())
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        No ticketing system is configured: GITHUB_TOKEN and GITHUB_REPO turn it
        on.
      </p>
    );
  const [tickets, synced] = await Promise.all([listTickets(), lastSync()]);
  const now = new Date();
  return (
    <>
      <form action={syncNow} className="mt-8 flex items-center gap-4">
        <PendingButton busy="Syncing…" icon={<RefreshCw />}>
          Sync now
        </PendingButton>
        <span className="text-sm text-muted-foreground">
          {synced ? `Last pulled ${when(synced, now)}` : "Not pulled yet"}
        </span>
      </form>
      <div className="mt-4 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Labels</TableHead>
              <TableHead>Changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground"
                >
                  No tickets yet
                </TableCell>
              </TableRow>
            )}
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <a href={t.url} className="hover:underline">
                    <span className="font-mono text-xs text-muted-foreground">
                      #{t.number}
                    </span>{" "}
                    {t.title}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge variant={t.state === "open" ? "default" : "secondary"}>
                    {t.state}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.assignee ?? "–"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.labels.join(", ")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {when(t.updatedAt, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

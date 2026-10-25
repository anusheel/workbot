import { RefreshCw, ScanSearch } from "lucide-react";
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
import { cacheSummary } from "@/lib/cache";
import { span, when } from "@/lib/format";
import { githubEnabled } from "@/lib/github";
import {
  type Contact,
  type Ticket,
  counts,
  lastSync,
  listContacts,
  listTickets,
  syncSummary,
} from "@/lib/unified";
import { reconcileNow, syncNow } from "./actions";

export const metadata: Metadata = { title: "Tickets" };

export default function TicketsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tickets and contacts in one shape, wherever they live: pulled every 15
        minutes, pushed by webhook, read again nightly, and run through the
        rules before the assistant sees them.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Synced />
      </Suspense>
    </>
  );
}

const percent = (share: number | null) =>
  share === null ? "–" : `${Math.round(share * 100)}%`;
const seconds = (s: number | null) => (s === null ? "–" : span(s));
const rules = (applied: { rule: string }[]) =>
  applied.map((a) => a.rule).join(", ") || "–";

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

async function Synced() {
  await io();
  const [tickets, contacts, synced, total, sync, cache] = await Promise.all([
    listTickets(),
    listContacts(20),
    lastSync(),
    counts(),
    syncSummary(),
    cacheSummary(),
  ]);
  const now = new Date();
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {githubEnabled() ? (
          <>
            <form action={syncNow}>
              <PendingButton busy="Syncing…" icon={<RefreshCw />}>
                Sync now
              </PendingButton>
            </form>
            <form action={reconcileNow}>
              <PendingButton busy="Reading every issue…" icon={<ScanSearch />}>
                Reconcile now
              </PendingButton>
            </form>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">
            No ticketing system is configured: GITHUB_TOKEN and GITHUB_REPO turn
            it on.
          </span>
        )}
        <span className="text-sm text-muted-foreground">
          {synced ? `Last pulled ${when(synced, now)}` : "Not pulled yet"}
        </span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="In the one shape"
          value={`${total.tickets} tickets`}
          note={`${total.contacts} contacts`}
        />
        <Stat
          label="Behind by, median"
          value={`webhook ${seconds(sync.medianLagS.webhook)}`}
          note={`pull ${seconds(sync.medianLagS.pull)}`}
        />
        <Stat
          label="Reconciliation found"
          value={`${sync.missed} missed`}
          note={`${sync.gone} gone, in the last day`}
        />
        <Stat
          label="Page cache"
          value={`${percent(cache.hitRate)} hits`}
          note={`${cache.reads} reads, served ${seconds(cache.medianAgeS)} old`}
        />
      </div>
      <h2 className="mt-8 text-lg font-medium">Tickets</h2>
      <div className="mt-3 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Rules</TableHead>
              <TableHead>Changed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 && <Empty what="tickets" />}
            {tickets.map((t) => (
              <TicketRow key={t.id} ticket={t} now={now} />
            ))}
          </TableBody>
        </Table>
      </div>
      <h2 className="mt-8 text-lg font-medium">Contacts</h2>
      <div className="mt-3 rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Seen in</TableHead>
              <TableHead>Rules</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 && <Empty what="contacts" />}
            {contacts.map((c) => (
              <ContactRow key={c.id} contact={c} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

const Empty = ({ what }: { what: string }) => (
  <TableRow>
    <TableCell colSpan={6} className="text-center text-muted-foreground">
      No {what} yet
    </TableCell>
  </TableRow>
);

function TicketRow({ ticket: t, now }: { ticket: Ticket; now: Date }) {
  return (
    <TableRow>
      <TableCell className="max-w-xl whitespace-normal">
        <a href={t.url} className="hover:underline">
          <span className="font-mono text-xs text-muted-foreground">
            {t.source === "github" ? `#${t.key}` : "request"}
          </span>{" "}
          {t.title}
        </a>
      </TableCell>
      <TableCell className="text-muted-foreground">{t.team ?? "–"}</TableCell>
      <TableCell>
        <Badge variant={t.state === "open" ? "default" : "secondary"}>
          {t.state}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {t.assignee ?? "–"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {rules(t.applied)}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {when(t.updatedAt, now)}
      </TableCell>
    </TableRow>
  );
}

function ContactRow({ contact: c }: { contact: Contact }) {
  return (
    <TableRow>
      <TableCell className="max-w-xs whitespace-normal">
        {c.url ? (
          <a href={c.url} className="hover:underline">
            {c.name}
          </a>
        ) : (
          c.name
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {c.company ?? "–"}
      </TableCell>
      <TableCell className="text-muted-foreground">{c.email ?? "–"}</TableCell>
      <TableCell className="text-muted-foreground">{c.phone ?? "–"}</TableCell>
      <TableCell className="text-muted-foreground">
        {c.source === "github" ? "tickets" : "documents"}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {rules(c.applied)}
      </TableCell>
    </TableRow>
  );
}

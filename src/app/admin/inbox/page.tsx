import { Bell, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileUpload } from "@/components/file-upload";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type InboxItem, type InboxStatus, listInbox } from "@/lib/inbox";
import { listNotifications } from "@/lib/notify";
import { review, runReminders, uploadDocuments } from "./actions";

export const metadata: Metadata = { title: "Inbox" };

const statusLabels: Record<
  InboxStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  received: { label: "Received", variant: "secondary" },
  extracted: { label: "Extracting", variant: "secondary" },
  awaiting_review: { label: "Needs review", variant: "outline" },
  stored: { label: "Filed", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  expired: { label: "Expired", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function InboxPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Documents on their way to becoming requests. Each one is a run of
            the approval workflow; a doubtful field pauses it here for you.
          </p>
        </div>
        <FileUpload
          action={uploadDocuments}
          name="documents"
          accept=".pdf,image/png,image/jpeg,image/webp"
          label="Upload documents"
          busy="Sending…"
          icon={<FileText />}
          multiple
        />
      </div>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Items />
      </Suspense>
      <Suspense>
        <Outbox />
      </Suspense>
    </>
  );
}

async function Items() {
  const items = await listInbox();
  if (items.length === 0)
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        Nothing yet. Upload up to 10 documents at once.
      </p>
    );
  return (
    <div className="mt-8 rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Document</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>To check</TableHead>
            <TableHead className="text-right">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.requestId ? (
                  <Link
                    href={`/requests/${item.requestId}`}
                    className="underline underline-offset-4"
                  >
                    {item.name}
                  </Link>
                ) : (
                  item.name
                )}
              </TableCell>
              <TableCell className="capitalize">{item.type ?? "—"}</TableCell>
              <TableCell>
                <Status item={item} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.review.join(", ") || "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {item.updatedAt.toLocaleTimeString("en-GB", {
                  timeStyle: "short",
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Status({ item }: { item: InboxItem }) {
  const { label, variant } = statusLabels[item.status];
  if (item.status !== "awaiting_review")
    return <Badge variant={variant}>{label}</Badge>;
  return (
    <form className="flex items-center gap-2">
      <Badge variant={variant}>{label}</Badge>
      <Button size="sm" formAction={review.bind(null, item.id, "approved")}>
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        formAction={review.bind(null, item.id, "rejected")}
      >
        Reject
      </Button>
    </form>
  );
}

async function Outbox() {
  const notifications = await listNotifications(8);
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Outbox</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What the workflows and the morning reminders would send.
          </p>
        </div>
        <form>
          <PendingButton
            formAction={runReminders}
            busy="Running…"
            icon={<Bell />}
          >
            Run the reminders now
          </PendingButton>
        </form>
      </div>
      {notifications.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing sent yet.</p>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border text-sm">
          {notifications.map((n) => (
            <li key={n.id} className="flex items-baseline gap-3 px-4 py-2.5">
              <span className="w-20 shrink-0 text-muted-foreground capitalize">
                {n.recipient}
              </span>
              <span className="flex-1">
                {n.link ? (
                  <Link href={n.link} className="underline underline-offset-4">
                    {n.message}
                  </Link>
                ) : (
                  n.message
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {n.createdAt.toLocaleTimeString("en-GB", {
                  timeStyle: "short",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { Bell, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FileUpload } from "@/components/file-upload";
import { InboxStatus } from "@/components/inbox-status";
import { PendingButton } from "@/components/pending-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listInbox } from "@/lib/inbox";
import { listNotifications } from "@/lib/notify";
import { review, runReminders, uploadDocuments } from "./actions";
import { permits, requireUser } from "@/lib/auth";
import { Allowed } from "@/components/allowed";
import { when } from "@/lib/format";

export const metadata: Metadata = { title: "Inbox" };

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
        <Suspense>
          <Allowed role="agent">
            <FileUpload
              action={uploadDocuments}
              name="documents"
              accept=".pdf,.docx,image/png,image/jpeg,image/webp"
              label="Upload documents"
              busy="Sending…"
              icon={<FileText />}
              multiple
            />
          </Allowed>
        </Suspense>
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
  const user = await requireUser();
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
                <InboxStatus
                  item={item}
                  review={permits(user.role, "agent") ? review : undefined}
                />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {item.status === "awaiting_review"
                  ? item.review.join(", ") || "—"
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {when(item.updatedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

async function Outbox() {
  const user = await requireUser();
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
        {permits(user.role, "admin") && (
          <form>
            <PendingButton
              formAction={runReminders}
              busy="Running…"
              icon={<Bell />}
            >
              Run the reminders now
            </PendingButton>
          </form>
        )}
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

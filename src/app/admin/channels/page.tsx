import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireUser } from "@/lib/auth";
import { listSenders } from "@/lib/channels";
import { config } from "@/lib/config";
import { textOf } from "@/lib/context";
import { when } from "@/lib/format";
import { recentHistories } from "@/lib/history";
import { listOutbound, windowOpen } from "@/lib/outbound";

export const metadata: Metadata = { title: "Channels" };

const names: Record<string, string> = {
  web: "Web",
  sms: "SMS",
  whatsapp: "WhatsApp",
  slack: "Slack",
};

// What each channel needs to be on, read from the configuration.
const channels = [
  { name: "Web", on: true, detail: "the chat page" },
  {
    name: "SMS",
    on: !!(config.twilio.authToken && config.twilio.smsFrom),
    detail: config.twilio.smsFrom ?? "no number",
  },
  {
    name: "WhatsApp",
    on: !!(config.twilio.authToken && config.twilio.whatsappFrom),
    detail: config.twilio.whatsappTemplate
      ? "with an approved template"
      : "no template for outside the window",
  },
  {
    name: "Slack",
    on: !!(config.slack.botToken && config.slack.signingSecret),
    detail: "mention the bot in a channel",
  },
];

export default function ChannelsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        One assistant on every channel, with one store of conversations: a
        person who links a phone or a Slack account continues the same
        conversation there.
      </p>
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {channels.map(({ name, on, detail }) => (
          <li key={name} className="rounded-xl border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{name}</span>
              <Badge variant={on ? "secondary" : "outline"}>
                {on ? "On" : "Off"}
              </Badge>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {detail}
            </p>
          </li>
        ))}
      </ul>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Lists />
      </Suspense>
    </>
  );
}

async function Lists() {
  await requireUser();
  const [conversations, senders, outbound] = await Promise.all([
    recentHistories(10),
    listSenders(10),
    listOutbound(10),
  ]);
  return (
    <>
      <section className="mt-10">
        <h2 className="text-base font-semibold">Conversations</h2>
        <div className="mt-3 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Last message</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead className="text-right">Messages</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conversations.map((c) => {
                const used = new Set(
                  c.messages.map((m) => m.metadata?.channel ?? "web"),
                );
                const last = c.messages.at(-1);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-72 truncate">
                      <Link
                        href={`/admin/channels/${encodeURIComponent(c.id)}`}
                        className="underline underline-offset-4"
                      >
                        {last ? textOf(last) : "—"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {[...used].map((name) => (
                          <Badge key={name} variant="outline">
                            {names[name] ?? name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.messages.length}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {when(c.updatedAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Senders</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          An address is linked to a person only by a code they sent from it;
          until then it is a person of its own.
        </p>
        <div className="mt-3 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Linked</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Last wrote</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {senders.map((s) => (
                <TableRow key={`${s.channel}:${s.address}`}>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {names[s.channel]}
                    </span>{" "}
                    {s.address}
                  </TableCell>
                  <TableCell>
                    {s.optedOutAt ? (
                      <Badge variant="destructive">Opted out</Badge>
                    ) : s.verifiedAt ? (
                      <Badge variant="secondary">Linked</Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.channel === "whatsapp"
                      ? windowOpen(s.lastInboundAt)
                        ? "Open"
                        : "Template only"
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {s.lastInboundAt ? when(s.lastInboundAt) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Sent</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each reply on SMS and WhatsApp, with the provider&apos;s last word on
          it.
        </p>
        <div className="mt-3 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outbound.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="max-w-64 truncate">{m.body}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {names[m.channel]} {m.address}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        m.status === "failed" || m.status === "undelivered"
                          ? "destructive"
                          : m.status === "delivered" || m.status === "read"
                            ? "secondary"
                            : "outline"
                      }
                      title={m.error ?? undefined}
                    >
                      {m.status}
                    </Badge>
                    {m.error && (
                      <p className="mt-1 max-w-56 truncate text-xs text-muted-foreground">
                        {m.error}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {m.attempts}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </>
  );
}

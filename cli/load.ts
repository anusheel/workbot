import { parseArgs } from "node:util";
import { inngest } from "@/inngest/client";
import { documentReceived } from "@/inngest/events";
import { close, query } from "@/lib/db";
import { receive } from "@/lib/inbox";

// A load test of the document queue on the running engine: a noisy
// integration sends its documents first, many of them broken, and four
// others send theirs after. Fairness holds when the others are not left
// waiting behind the noisy one's backlog; nothing is lost when every
// document ends stored, waiting for a reviewer, or failed with a dead letter.
// Usage: pnpm load [--noisy 300] [--broken 100] [--each 50] [--minutes 30]
const { values } = parseArgs({
  options: {
    noisy: { type: "string", default: "300" },
    broken: { type: "string", default: "100" },
    each: { type: "string", default: "50" },
    minutes: { type: "string", default: "30" },
  },
});
const noisy = Number(values.noisy);
const broken = Number(values.broken);
const each = Number(values.each);
const run = new Date().toISOString().slice(11, 19).replaceAll(":", "");
const owners = ["noisy", "north", "east", "south", "west"].map(
  (name) => `load-${run}-${name}`,
);

const email = (owner: string, n: number) =>
  new TextEncoder().encode(
    `From: buyer${n}@${owner.split("-").at(-1)}-builders.example\nTo: orders@fieldstone.example\nSubject: Order ${1000 + n}: ${n % 7} pallets of block\n\nPlease confirm order ${1000 + n} for ${n % 7} pallets of 8 in concrete block, delivery to site ${n % 13}.`,
  );
// A PDF in name only: the model's provider refuses it, and no retry can change that.
const brokenPdf = new TextEncoder().encode("%PDF-1.7\nnot a document");

const jobs: {
  owner: string;
  name: string;
  type: "text/plain" | "application/pdf";
  bytes: Uint8Array;
}[] = [
  ...Array.from({ length: noisy }, (_, n) => ({
    owner: owners[0],
    name: `noisy-${n}`,
    ...(n % Math.round(noisy / broken) === 0
      ? { type: "application/pdf" as const, bytes: brokenPdf }
      : { type: "text/plain" as const, bytes: email(owners[0], n) }),
  })),
  ...owners.slice(1).flatMap((owner) =>
    Array.from({ length: each }, (_, n) => ({
      owner,
      name: `${owner.split("-").at(-1)}-${n}`,
      type: "text/plain" as const,
      bytes: email(owner, n),
    })),
  ),
];
const started = Date.now();
for (const job of jobs) {
  const item = await receive(job.name, job.type, job.bytes, job.owner);
  await inngest.send(
    documentReceived.create({ id: item.id, owner: job.owner }),
  );
}
console.log(
  `${jobs.length} queued in ${((Date.now() - started) / 1000).toFixed(1)} s; ${jobs.filter((j) => j.type === "application/pdf").length} broken, all from ${owners[0]}`,
);

type Row = { owner: string; status: string; seconds: number };
const done = ["stored", "awaiting_review", "failed", "rejected"];
const deadline = started + Number(values.minutes) * 60_000;
let rows: Row[] = [];
while (Date.now() < deadline) {
  rows = await query<Row>(
    `select owner, status, extract(epoch from updated_at - created_at)::float as seconds from inbox where owner = any($1)`,
    [owners],
  );
  const finished = rows.filter((r) => done.includes(r.status)).length;
  process.stderr.write(`\r${finished}/${jobs.length} finished`);
  if (finished === jobs.length) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
process.stderr.write("\n");

const percentile = (values: number[], p: number) =>
  values.sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(p * values.length))
  ] ?? 0;
const letters = await query<{ owner: string; count: number }>(
  `select owner, count(*)::int as count from dead_letters where owner = any($1) group by owner`,
  [owners],
);
console.log(
  "\n| Sender | Sent | Stored | For review | Failed | Dead letters | p50 s | p95 s | Last s |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const owner of owners) {
  const mine = rows.filter((r) => r.owner === owner);
  const finished = mine
    .filter((r) => done.includes(r.status))
    .map((r) => r.seconds);
  const count = (status: string) =>
    mine.filter((r) => r.status === status).length;
  console.log(
    `| ${owner.split("-").at(-1)} | ${mine.length} | ${count("stored")} | ${count("awaiting_review")} | ${count("failed")} | ${letters.find((l) => l.owner === owner)?.count ?? 0} | ${percentile(finished, 0.5).toFixed(0)} | ${percentile(finished, 0.95).toFixed(0)} | ${Math.max(0, ...finished).toFixed(0)} |`,
  );
}
const unfinished = rows.filter((r) => !done.includes(r.status)).length;
const lost = jobs.length - rows.length;
console.log(
  `\n${unfinished} unfinished, ${lost} lost, ${((Date.now() - started) / 1000).toFixed(0)} s in all`,
);
await close();

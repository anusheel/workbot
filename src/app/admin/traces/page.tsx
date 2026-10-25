import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { when } from "@/lib/format";
import { traceSummary } from "@/lib/tracing";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Traces" };

const dollars = (n: number) => `$${n.toFixed(4)}`;

function Empty({ cols }: { cols: number }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="text-center text-muted-foreground">
        No calls in the last 24 hours
      </TableCell>
    </TableRow>
  );
}

export default function TracesPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Traces</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every model call of the last 24 hours: what it cost, how long it took,
        whether it failed, and for whom.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  await requireUser();
  const day = await traceSummary(24);
  const errorRate = day.calls ? (100 * day.errors) / day.calls : 0;
  const now = new Date();
  const tiles = [
    ["Calls", String(day.calls)],
    ["Spend", dollars(day.dollars)],
    ["Errors", `${errorRate.toFixed(1)}%`],
    ["Latency p50 / p95", day.calls ? `${day.p50} / ${day.p95} ms` : "–"],
  ];
  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-2xl">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">
            Spend by caller
          </h2>
          <div className="mt-3 rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caller</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.byCaller.length === 0 && <Empty cols={3} />}
                {day.byCaller.map((row) => (
                  <TableRow key={row.caller}>
                    <TableCell className="font-mono text-xs" title={row.caller}>
                      {row.caller.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-right">{row.calls}</TableCell>
                    <TableCell className="text-right">
                      {dollars(row.dollars)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
        <section>
          <h2 className="text-sm font-medium text-muted-foreground">
            By prompt version
          </h2>
          <div className="mt-3 rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prompt</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">p50</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.byPrompt.length === 0 && <Empty cols={4} />}
                {day.byPrompt.map((row) => (
                  <TableRow key={row.prompt}>
                    <TableCell className="font-mono text-xs">
                      {row.prompt}
                    </TableCell>
                    <TableCell className="text-right">{row.calls}</TableCell>
                    <TableCell className="text-right">
                      {dollars(row.dollars)}
                    </TableCell>
                    <TableCell className="text-right">{row.p50} ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">
          Latest calls
        </h2>
        <div className="mt-3 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Call</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">In / cached / out</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.recent.length === 0 && <Empty cols={8} />}
              {day.recent.map((trace) => (
                <TableRow key={trace.id}>
                  <TableCell className="text-muted-foreground">
                    {when(trace.at, now)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {trace.caller.slice(0, 8)}
                  </TableCell>
                  <TableCell>{trace.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {trace.model}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {trace.input} / {trace.cached} / {trace.output}
                  </TableCell>
                  <TableCell className="text-right">
                    {dollars(trace.dollars)}
                  </TableCell>
                  <TableCell className="text-right">{trace.ms} ms</TableCell>
                  <TableCell>
                    {trace.ok ? (
                      <Badge variant="secondary">ok</Badge>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="destructive">failed</Badge>
                        {trace.error && (
                          <p className="max-w-xs text-xs whitespace-normal text-muted-foreground">
                            {trace.error}
                          </p>
                        )}
                      </div>
                    )}
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

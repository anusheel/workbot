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
import { traceSummary } from "@/lib/tracing";

export const metadata: Metadata = { title: "Traces" };

const dollars = (n: number) => `$${n.toFixed(4)}`;

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
  const day = await traceSummary(24);
  const errorRate = day.calls ? (100 * day.errors) / day.calls : 0;
  const tiles = [
    ["Calls", String(day.calls)],
    ["Spend", dollars(day.dollars)],
    ["Errors", `${errorRate.toFixed(1)}%`],
    ["Latency p50 / p95", `${day.p50} / ${day.p95} ms`],
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
            Spend by tenant
          </h2>
          <div className="mt-3 rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {day.byTenant.map((row) => (
                  <TableRow key={row.tenant}>
                    <TableCell className="font-mono text-xs">
                      {row.tenant}
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
                <TableHead>Tenant</TableHead>
                <TableHead>Call</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">In / cached / out</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {day.recent.map((trace) => (
                <TableRow key={trace.id}>
                  <TableCell className="text-muted-foreground">
                    {trace.at.toLocaleTimeString("en-GB", {
                      timeStyle: "medium",
                    })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {trace.tenant.slice(0, 8)}
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
                      <Badge variant="destructive" title={trace.error ?? ""}>
                        failed
                      </Badge>
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

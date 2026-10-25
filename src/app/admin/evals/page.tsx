import { readFile } from "node:fs/promises";
import type { Metadata } from "next";
import { io } from "next/cache";
import { Suspense } from "react";
import { Sparkline } from "@/components/sparkline";
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
import { evalTasks } from "@/lib/eval-suite";
import { when } from "@/lib/format";
import { fleet, frameworkSummary, margin, runs } from "@/lib/scoreboard";
import { failovers } from "@/lib/tracing";

export const metadata: Metadata = { title: "Evals" };

export default function EvalsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Evals</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every recorded run of the 3 evals on their routes, the fallbacks of the
        last day, the framework comparison and what the fleet did.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        }
      >
        <Board />
      </Suspense>
    </>
  );
}

function Tiles({ tiles }: { tiles: [string, string][] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
      {tiles.map(([label, value]) => (
        <Card key={label}>
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="text-2xl">{value}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

async function Board() {
  await io();
  const [all, fallbacks, frameworks, fleetRun] = await Promise.all([
    runs(),
    failovers(24),
    readFile("docs/frameworks.md", "utf8").catch(() => ""),
    fleet(),
  ]);
  return (
    <>
      {evalTasks.map((task) => {
        const recorded = all.filter((r) => r.task === task).slice(-12);
        const latest = recorded.at(-1);
        return (
          <section key={task} className="mt-10">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-muted-foreground">
                {task}
                {latest &&
                  `: ${latest.mean.toFixed(2)} ± ${margin(latest).toFixed(2)} on ${latest.route}`}
              </h2>
              <Sparkline
                values={recorded.map((r) => r.mean)}
                label={`${task} scores over the last ${recorded.length} runs`}
              />
            </div>
            <div className="mt-3 rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Commit</TableHead>
                    <TableHead>Cases</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead className="text-right">Mean</TableHead>
                    <TableHead className="text-right">Hard</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">p95</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recorded.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground"
                      >
                        No run recorded; pnpm eval --task {task} --record
                      </TableCell>
                    </TableRow>
                  )}
                  {[...recorded].reverse().map((r) => (
                    <TableRow key={r.at}>
                      <TableCell className="text-muted-foreground">
                        {when(new Date(r.at), new Date())}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.commit}
                      </TableCell>
                      <TableCell>
                        {r.cases} × {r.runs}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {r.subset}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.route}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.prompt}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.mean.toFixed(2)} ± {margin(r).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{r.hard}</TableCell>
                      <TableCell className="text-right">
                        ${r.dollars.toFixed(3)}
                      </TableCell>
                      <TableCell className="text-right">{r.p95} ms</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">
          Fallbacks, last 24 hours
        </h2>
        <Tiles
          tiles={[
            ["Failed calls", String(fallbacks.failed)],
            ["Answered by the next model", String(fallbacks.recovered)],
          ]}
        />
        <div className="mt-4 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Error rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fallbacks.byModel.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No calls in the last 24 hours
                  </TableCell>
                </TableRow>
              )}
              {fallbacks.byModel.map((m) => (
                <TableRow key={m.model}>
                  <TableCell className="font-mono text-xs">{m.model}</TableCell>
                  <TableCell className="text-right">{m.calls}</TableCell>
                  <TableCell className="text-right">{m.failed}</TableCell>
                  <TableCell className="text-right">
                    {((100 * m.failed) / m.calls).toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">
          The research agent on 3 frameworks (Day 23), means over 5 topics
        </h2>
        <div className="mt-3 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Framework</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="text-right">Tool calls</TableHead>
                <TableHead className="text-right">Tokens in</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {frameworkSummary(frameworks).map((f) => (
                <TableRow key={f.framework}>
                  <TableCell className="font-mono text-xs">
                    {f.framework}
                  </TableCell>
                  <TableCell className="text-right">
                    {f.seconds.toFixed(0)} s
                  </TableCell>
                  <TableCell className="text-right">
                    {f.calls.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    {f.tokensIn.toLocaleString("en-US")}
                  </TableCell>
                  <TableCell className="text-right">
                    ${f.dollars.toFixed(3)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
      <section className="mt-10">
        <h2 className="text-sm font-medium text-muted-foreground">
          The fleet (Day 22){fleetRun && `, on ${fleetRun.base}`}
        </h2>
        {fleetRun ? (
          <Tiles
            tiles={[
              ["Merged", `${fleetRun.merged} in ${fleetRun.hours} h`],
              ["An hour", String(fleetRun.perHour)],
              ["Reverted", String(fleetRun.reverted)],
              [
                "Brief to merge",
                `${fleetRun.medianMinutes} min, p90 ${fleetRun.p90Minutes}`,
              ],
            ]}
          />
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No fleet report; scripts/fleet.mjs report --json writes one.
          </p>
        )}
      </section>
    </>
  );
}

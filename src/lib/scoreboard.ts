import { appendFile, readFile } from "node:fs/promises";
import type { EvalTask } from "./eval-suite";

/** One recorded run of a task's eval, as `pnpm eval --record` writes it: one line of the scoreboard. */
export type Run = {
  at: string;
  commit: string;
  task: EvalTask;
  subset: "smoke" | "full";
  route: string;
  prompt: string;
  cases: number;
  runs: number;
  mean: number;
  sd: number;
  hard: number;
  dollars: number;
  p95: number;
};

const scoreboard = "content/eval/scoreboard.jsonl";

/** Every recorded run, oldest first; none when nothing has been recorded. */
export async function runs(): Promise<Run[]> {
  const text = await readFile(scoreboard, "utf8").catch(() => "");
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export const recordRun = (run: Run) =>
  appendFile(scoreboard, `${JSON.stringify(run)}\n`);

/** The half-width of a run's 95% interval: what its mean is known to within. */
export const margin = ({ sd, cases, runs }: Run) =>
  (1.96 * sd) / Math.sqrt(cases * runs);

/** A framework's means over the topics of docs/frameworks.md. */
export type FrameworkRow = {
  framework: string;
  topics: number;
  seconds: number;
  calls: number;
  tokensIn: number;
  dollars: number;
};

/** The comparison table of docs/frameworks.md, read from the document so it is written once: one row per framework. */
export function frameworkSummary(markdown: string): FrameworkRow[] {
  const rows = markdown
    .split("\n")
    .map((line) => line.split("|").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 8 && /^\d+ s$/.test(cells[3]));
  const sums = new Map<string, FrameworkRow>();
  for (const [, , framework, time, calls, tokens, cost] of rows) {
    const row = sums.get(framework) ?? {
      framework,
      topics: 0,
      seconds: 0,
      calls: 0,
      tokensIn: 0,
      dollars: 0,
    };
    row.topics += 1;
    row.seconds += parseInt(time);
    row.calls += Number(calls);
    row.tokensIn += parseInt(tokens);
    row.dollars += Number(cost.replace("$", ""));
    sums.set(framework, row);
  }
  return [...sums.values()].map((row) => ({
    ...row,
    seconds: row.seconds / row.topics,
    calls: row.calls / row.topics,
    tokensIn: Math.round(row.tokensIn / row.topics),
    dollars: row.dollars / row.topics,
  }));
}

/** What the fleet did, as `scripts/fleet.mjs report --json` writes it. */
export type Fleet = {
  base: string;
  at: string;
  merged: number;
  hours: number;
  perHour: number;
  reverted: number;
  medianMinutes: number;
  p90Minutes: number;
};

export const fleet = (): Promise<Fleet | undefined> =>
  readFile("content/eval/fleet.json", "utf8")
    .then((text) => JSON.parse(text) as Fleet)
    .catch(() => undefined);

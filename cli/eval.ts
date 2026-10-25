import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { close } from "@/lib/db";
import { detectable, stats } from "@/lib/eval";
import { withBrowser } from "@/lib/eval-documents";
import {
  type Case,
  type EvalTask,
  chatSuite,
  evalTasks,
  extractSuite,
  triageSuite,
} from "@/lib/eval-suite";
import { versions } from "@/lib/prompts";
import { modelFor, routes } from "@/lib/routing";
import { type Run, recordRun, runs as recorded } from "@/lib/scoreboard";
import { systemPrompt } from "@/lib/system-prompt";
import { spend, withTrace } from "@/lib/tracing";

// The evals of the 3 tasks on their production routes: every case several
// times, scored, with the bill and the p95 of a call read back from the traces.
// The gate exits 1 on a hard failure or a mean under the threshold and warns of
// a soft regression against the last recorded run of the same subset. Usage:
//   pnpm eval [--task chat|extract|triage|all] [--smoke] [--runs 2] [--only kind|id]
//            [--prompt workbot/system@2] [--gate] [--record] [--report file]
const { values } = parseArgs({
  options: {
    task: { type: "string", default: "chat" },
    smoke: { type: "boolean", default: false },
    runs: { type: "string", default: "2" },
    only: { type: "string" },
    prompt: { type: "string" },
    gate: { type: "boolean", default: false },
    record: { type: "boolean", default: false },
    report: { type: "string" },
  },
});
const runs = Number(values.runs);
const tasks =
  values.task === "all" ? [...evalTasks] : ([values.task] as EvalTask[]);
if (!tasks.every((t) => evalTasks.includes(t)))
  throw new Error(`--task is one of ${evalTasks.join(", ")} or all`);
const subset = values.smoke ? "smoke" : "full";
// A mean under this is a broken prompt, whatever the baseline was.
const threshold = 0.7;
const commit =
  process.env.GITHUB_SHA?.slice(0, 7) ??
  execFileSync("git", ["rev-parse", "--short", "HEAD"]).toString().trim();

async function promptText(): Promise<[string, string]> {
  if (!values.prompt) return ["code", systemPrompt];
  const [name, version] = values.prompt.split("@");
  const row = (await versions(name)).find((v) => v.version === Number(version));
  if (!row) throw new Error(`No prompt ${values.prompt}`);
  return [values.prompt, row.text];
}

async function suiteOf(task: EvalTask): Promise<[string, Case[]]> {
  switch (task) {
    case "chat": {
      const [label, prompt] = await promptText();
      return [label, await chatSuite(prompt, modelFor("judge"))];
    }
    case "extract":
      return ["code", await withBrowser(extractSuite)];
    case "triage":
      return ["code", await triageSuite()];
  }
}

/** The last recorded run of the same task and subset, which a soft regression is measured against. */
const baseline = async (task: EvalTask) =>
  (await recorded()).findLast(
    (run) => run.task === task && run.subset === subset,
  );

let failed = false;
const report: string[] = [];
for (const task of tasks) {
  const [label, suite] = await suiteOf(task);
  const cases = suite.filter(
    (c) =>
      (!values.smoke || c.smoke) &&
      (!values.only || c.kind === values.only || c.id === values.only),
  );
  if (!cases.length) {
    console.log(`${task}: no case matched`);
    continue;
  }
  const ctx = { tenant: "eval", name: task, prompt: label };
  const since = new Date();
  const lines = [
    `## ${task}: ${cases.length} cases, ${runs} runs each, prompt ${label}`,
    "",
    "| Case | Kind | Mean | SD | Last reason |",
    "| --- | --- | --- | --- | --- |",
  ];
  const all: number[] = [];
  let hard = 0;
  for (const c of cases) {
    const scores: number[] = [];
    let reason = "";
    for (let run = 0; run < runs; run++) {
      const verdict = await withTrace(ctx, () => c.run(modelFor(task)));
      scores.push(verdict.score);
      reason = verdict.reason;
      if (verdict.violations.length) hard++;
    }
    const { mean, sd } = stats(scores);
    all.push(...scores);
    lines.push(
      `| ${c.id} | ${c.kind} | ${mean.toFixed(2)} | ${sd.toFixed(2)} | ${reason.replace(/\|/g, "/").slice(0, 90)} |`,
    );
  }
  const { mean, sd, count } = stats(all);
  const noise = detectable(sd, count);
  const { dollars, p95 } = await spend(ctx, since);
  const base = await baseline(task);
  const against = base
    ? ` against ${base.mean.toFixed(2)} on ${base.commit}`
    : "";
  const verdict = hard
    ? `FAIL: ${hard} hard failures`
    : mean < threshold
      ? `FAIL: mean ${mean.toFixed(2)} under ${threshold}`
      : base && mean < base.mean - noise
        ? `WARN: mean ${mean.toFixed(2)}${against}`
        : `PASS: mean ${mean.toFixed(2)}${against}`;
  if (verdict.startsWith("FAIL")) failed = true;
  lines.push(
    "",
    `Mean ${mean.toFixed(2)}, SD ${sd.toFixed(2)} over ${count} scored answers; a change under ${noise.toFixed(2)} is noise at this size. $${dollars.toFixed(4)}, p95 ${p95} ms. ${verdict}`,
    "",
  );
  console.log(lines.join("\n"));
  report.push(...lines);
  if (values.record) {
    const run: Run = {
      at: since.toISOString(),
      commit,
      task,
      subset,
      route: routes[task][0],
      prompt: label,
      cases: cases.length,
      runs,
      mean: Number(mean.toFixed(3)),
      sd: Number(sd.toFixed(3)),
      hard,
      dollars: Number(dollars.toFixed(4)),
      p95,
    };
    await recordRun(run);
  }
}
if (values.report) await writeFile(values.report, report.join("\n"));
await close();
if (values.gate && failed) process.exit(1);

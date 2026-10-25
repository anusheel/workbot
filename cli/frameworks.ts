import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { close } from "@/lib/db";
import { frameworkNames, frameworks } from "@/lib/frameworks";
import { asOperator } from "@/lib/tracing";

// The research agent on each framework, on the 5 topics: wall time, tool
// calls, tokens and cost per run, the reports under .data/frameworks.
// Usage: pnpm frameworks [--only langgraph|claude|openai] [--topic <id>] [--thread <id>]
const { values } = parseArgs({
  options: {
    only: { type: "string" },
    topic: { type: "string" },
    thread: { type: "string" },
  },
});
const Topic = z.object({ id: z.string(), question: z.string() });
const topics = z
  .array(Topic)
  .parse(JSON.parse(await readFile("content/eval/topics.json", "utf8")))
  .filter((t) => !values.topic || t.id === values.topic);
const names = frameworkNames.filter((n) => !values.only || n === values.only);
// A thread holds one run, so continuing one means one topic.
if (values.thread && topics.length !== 1) {
  console.error("--thread continues one run: name its topic with --topic.");
  process.exit(1);
}
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`;
const out = ".data/frameworks";
await mkdir(out, { recursive: true });

console.log(
  "| Topic | Framework | Time | Tool calls | Tokens in / out | Cost | Findings |",
);
console.log("| --- | --- | --- | --- | --- | --- | --- |");
const totals = Object.fromEntries(
  names.map((n) => [n, { runs: 0, ms: 0, calls: 0, dollars: 0 }]),
);
for (const topic of topics)
  for (const name of names) {
    const run = await asOperator("frameworks", () =>
      frameworks[name](topic.question, {
        thread: name === "langgraph" ? values.thread : undefined,
        on: {
          tool: (tool) => console.error(dim(`  ${name} ${topic.id}: ${tool}`)),
        },
      }),
    ).catch((error: Error) => {
      console.error(`${name} on ${topic.id}: ${error.message}`);
      return undefined;
    });
    if (!run) continue;
    await writeFile(`${out}/${topic.id}-${name}.md`, `${run.report}\n`);
    console.log(
      `| ${topic.id} | ${name} | ${(run.ms / 1000).toFixed(0)} s | ${run.toolCalls} | ${run.usage.input} / ${run.usage.output} | $${run.dollars.toFixed(3)} | ${run.findings.length} |`,
    );
    const total = totals[name];
    total.runs += 1;
    total.ms += run.ms;
    total.calls += run.toolCalls;
    total.dollars += run.dollars;
  }
console.log();
for (const [name, t] of Object.entries(totals))
  if (t.runs)
    console.log(
      `${name}: ${t.runs} runs, ${(t.ms / t.runs / 1000).toFixed(0)} s and ${(t.calls / t.runs).toFixed(1)} tool calls a run, $${t.dollars.toFixed(3)} in all`,
    );
await close();

import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { type AgentRun, runAgent } from "@/lib/agent";
import { close } from "@/lib/db";
import { Golden, judge, stats } from "@/lib/eval";
import { investigate } from "@/lib/investigate";
import { knowledgeTools } from "@/lib/knowledge-tools";
import { modelFor } from "@/lib/routing";
import { tool } from "@/lib/tool";
import { readUrl } from "@/lib/tools";
import { withTrace } from "@/lib/tracing";

// The golden answer cases through the research analyst with its 2 specialists
// and through one agent holding the same tools, each report scored by the
// judge: the eval that says whether the second agent earns its place.
// Usage: pnpm compare:agents [--only id] [--runs 1]
const { values } = parseArgs({
  options: { only: { type: "string" }, runs: { type: "string", default: "1" } },
});
const runs = Number(values.runs);
const cases = z
  .array(Golden)
  .parse(JSON.parse(await readFile("content/eval/golden.json", "utf8")))
  .filter((c) => c.kind === "answer" && (!values.only || c.id === values.only));

const single = `You answer a ticket's question from the company's knowledge base: find first, cat what looks relevant before you rely on it, grep for an exact number or phrase, and read_url for a page the question names. Save each fact that bears on the question with save_finding, with the document's title as the source. When the findings answer the question, or nothing more can be found, call write_report once: the answer in plain sentences, each fact followed by its source in brackets, then a line per source. Numerals for numbers; no guesses.`;

/** One agent with the analyst's tools and no specialists, on the research route. */
async function alone(question: string): Promise<AgentRun> {
  const findings: string[] = [];
  return runAgent({
    model: modelFor("research"),
    system: single,
    task: question,
    tools: [
      ...knowledgeTools(),
      readUrl,
      tool({
        name: "save_finding",
        description:
          "Saves one fact that answers part of the question, with its source.",
        input: z.object({ text: z.string().min(5), source: z.string().min(2) }),
        run: ({ text, source }) => {
          findings.push(`${text} [${source}]`);
          return `Saved finding ${findings.length}.`;
        },
      }),
      tool({
        name: "write_report",
        description: "Ends the work with the report. Call it once.",
        input: z.object({ report: z.string().min(20) }),
        run: ({ report }) => report,
      }),
    ],
    done: "write_report",
    limits: { seconds: 300 },
  });
}

type Row = { score: number; dollars: number; seconds: number };
const timed = async (
  fn: () => Promise<{ report: string; dollars: number }>,
  golden: Golden,
): Promise<Row> => {
  const started = Date.now();
  const { report, dollars } = await fn();
  const seconds = (Date.now() - started) / 1000;
  const { score } = await withTrace({ tenant: "compare", name: "judge" }, () =>
    judge(golden, { text: report, tools: [] }, modelFor("judge")),
  );
  return { score, dollars, seconds };
};

console.log("| Case | Analyst + specialists | One agent |");
console.log("| --- | --- | --- | ");
const totals = { analyst: [] as Row[], alone: [] as Row[] };
for (const golden of cases) {
  for (let run = 0; run < runs; run++) {
    const a = await withTrace({ tenant: "compare", name: "analyst" }, () =>
      timed(
        () =>
          investigate(golden.question, {
            analyst: modelFor("research"),
            specialist: modelFor("read"),
          }),
        golden,
      ),
    );
    const b = await withTrace({ tenant: "compare", name: "alone" }, () =>
      timed(async () => {
        const run = await alone(golden.question);
        return {
          report: run.answer || `Stopped (${run.stopped}).`,
          dollars: run.dollars,
        };
      }, golden),
    );
    totals.analyst.push(a);
    totals.alone.push(b);
    const cell = (r: Row) =>
      `${r.score.toFixed(2)}, $${r.dollars.toFixed(4)}, ${r.seconds.toFixed(0)} s`;
    console.log(`| ${golden.id} | ${cell(a)} | ${cell(b)} |`);
  }
}
const summary = (rows: Row[]) => {
  const { mean, sd } = stats(rows.map((r) => r.score));
  const dollars = rows.reduce((a, r) => a + r.dollars, 0) / rows.length;
  const seconds = rows.reduce((a, r) => a + r.seconds, 0) / rows.length;
  return `score ${mean.toFixed(2)} (SD ${sd.toFixed(2)}), $${dollars.toFixed(4)} and ${seconds.toFixed(0)} s a question`;
};
console.log(
  `\nAnalyst + specialists: ${summary(totals.analyst)}\nOne agent: ${summary(totals.alone)}\nover ${totals.alone.length} questions`,
);
await close();

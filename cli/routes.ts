import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { LoadAPIKeyError } from "@ai-sdk/provider";
import type { LanguageModel } from "ai";
import { chromium } from "playwright-core";
import { z } from "zod";
import { close } from "@/lib/db";
import {
  Golden,
  IntakeCase,
  answer,
  judge,
  stats,
  triageScore,
} from "@/lib/eval";
import { documentCases, extractionResult } from "@/lib/eval-documents";
import { triage } from "@/lib/intake";
import { providerNames, sizes } from "@/lib/providers";
import { type Route, type Task, modelFor, modelOf } from "@/lib/routing";
import { systemPrompt } from "@/lib/system-prompt";
import { type Context, spend, withTrace } from "@/lib/tracing";

// Each task that has an eval, on each provider's models: the score, the cost
// per case and the p95 latency of a call, read back from the traces of the run.
// Usage: pnpm routes [--task chat|extract|triage] [--provider anthropic|openai] [--runs 1]
const { values } = parseArgs({
  options: {
    task: { type: "string" },
    provider: { type: "string" },
    runs: { type: "string", default: "1" },
  },
});
const runs = Number(values.runs);

const golden = z
  .array(Golden)
  .parse(JSON.parse(await readFile("content/eval/golden.json", "utf8")));
const intake = z
  .array(IntakeCase)
  .parse(JSON.parse(await readFile("content/eval/intake.json", "utf8")));
const wanted = (task: Task) => !values.task || task === values.task;

// The documents are rendered by Chrome, so the browser is opened only when extraction is measured.
async function renderedDocuments() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    return await documentCases(browser);
  } finally {
    await browser.close();
  }
}
const documents = wanted("extract") ? await renderedDocuments() : [];

/** One case of a task on a model, scored 0 to 1. */
type Case = (model: LanguageModel) => Promise<number>;
const evals: Partial<Record<Task, Case[]>> = {
  chat: golden.map((c) => async (model) => {
    const reply = await answer(c, systemPrompt, model);
    // The judge runs under its own name, so its calls are not on the bill of the model judged.
    const { score } = await withTrace({ tenant: "routes", name: "judge" }, () =>
      judge(c, reply, modelFor("judge")),
    );
    return score;
  }),
  extract: documents.map((c) => async (model) => {
    const { type, wrong } = await extractionResult(c, model);
    const fields = Object.keys(c.want.data).length;
    // The wrong kind means the wrong schema, so nothing would have come out right.
    return type === c.want.type ? (fields - wrong.length) / fields : 0;
  }),
  triage: intake.map(
    (c) => async (model) => triageScore(c, await triage(c.message, model)),
  ),
};

console.log("| Task | Route | Score | SD | $/case | p95 ms | Calls |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const [task, cases] of Object.entries(evals) as [Task, Case[]][]) {
  if (!wanted(task)) continue;
  for (const provider of providerNames) {
    if (values.provider && provider !== values.provider) continue;
    for (const size of sizes) {
      const route: Route = `${provider}/${size}`;
      const ctx: Context = { tenant: "routes", name: task, prompt: route };
      const since = new Date();
      const scores: number[] = [];
      try {
        for (let run = 0; run < runs; run++)
          for (const score of cases)
            scores.push(await withTrace(ctx, () => score(modelOf(route))));
      } catch (error) {
        // A provider without a key has no row to fill; anything else is a failure of the run.
        if (!LoadAPIKeyError.isInstance(error)) throw error;
        console.log(`| ${task} | ${route} | no key | | | | |`);
        continue;
      }
      const { mean, sd } = stats(scores);
      const { calls, dollars, p95 } = await spend(ctx, since);
      console.log(
        `| ${task} | ${route} | ${mean.toFixed(2)} | ${sd.toFixed(2)} | $${(dollars / scores.length).toFixed(4)} | ${p95} | ${calls} |`,
      );
    }
  }
}
await close();

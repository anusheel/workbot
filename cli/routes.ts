import { parseArgs } from "node:util";
import { LoadAPIKeyError } from "@ai-sdk/provider";
import { close } from "@/lib/db";
import { stats } from "@/lib/eval";
import { withBrowser } from "@/lib/eval-documents";
import {
  type Case,
  type EvalTask,
  chatSuite,
  evalTasks,
  extractSuite,
  triageSuite,
} from "@/lib/eval-suite";
import { providerNames, sizes } from "@/lib/providers";
import { type Route, modelFor, modelOf } from "@/lib/routing";
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

const wanted = (task: EvalTask) => !values.task || task === values.task;
// The documents are rendered by Chrome, so the browser is opened only when extraction is measured.
const suites: Record<EvalTask, Case[]> = {
  chat: await chatSuite(systemPrompt, modelFor("judge")),
  extract: wanted("extract") ? await withBrowser(extractSuite) : [],
  triage: await triageSuite(),
};

console.log("| Task | Route | Score | SD | $/case | p95 ms | Calls |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const task of evalTasks) {
  if (!wanted(task)) continue;
  const cases = suites[task];
  for (const provider of providerNames) {
    if (values.provider && provider !== values.provider) continue;
    for (const size of sizes) {
      const route: Route = `${provider}/${size}`;
      const ctx: Context = { caller: "routes", name: task, prompt: route };
      const since = new Date();
      const scores: number[] = [];
      try {
        for (let run = 0; run < runs; run++)
          for (const c of cases)
            scores.push(
              (await withTrace(ctx, () => c.run(modelOf(route)))).score,
            );
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

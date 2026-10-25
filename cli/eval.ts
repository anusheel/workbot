import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { chatModel } from "@/lib/chat";
import { close } from "@/lib/db";
import { Golden, answer, judge, stats } from "@/lib/eval";
import { versions } from "@/lib/prompts";
import { systemPrompt } from "@/lib/system-prompt";
import { withTrace } from "@/lib/tracing";

// The golden set against a prompt version, several runs each, scored by the
// judge. Usage: pnpm eval [--prompt workbot/system@2] [--runs 2] [--only refusal]
const { values } = parseArgs({
  options: {
    prompt: { type: "string" },
    runs: { type: "string", default: "2" },
    only: { type: "string" },
  },
});
const runs = Number(values.runs);
const cases = z
  .array(Golden)
  .parse(JSON.parse(await readFile("content/eval/golden.json", "utf8")))
  .filter(
    (c) => !values.only || c.kind === values.only || c.id === values.only,
  );

async function promptText(): Promise<[string, string]> {
  if (!values.prompt) return ["code", systemPrompt];
  const [name, version] = values.prompt.split("@");
  const row = (await versions(name)).find((v) => v.version === Number(version));
  if (!row) throw new Error(`No prompt ${values.prompt}`);
  return [values.prompt, row.text];
}
const [label, prompt] = await promptText();
const model = chatModel();
const judgeModel = chatModel("small");

console.log(`Prompt ${label}, ${cases.length} cases, ${runs} runs each\n`);
console.log("| Case | Kind | Mean | SD | Last reason |");
console.log("| --- | --- | --- | --- | --- |");
const all: number[] = [];
await withTrace({ tenant: "eval", name: "eval", prompt: label }, async () => {
  for (const golden of cases) {
    const scores: number[] = [];
    let reason = "";
    for (let run = 0; run < runs; run++) {
      const reply = await answer(golden, prompt, model);
      const verdict = await judge(golden, reply, judgeModel);
      scores.push(verdict.score);
      reason = verdict.reason;
    }
    const { mean, sd } = stats(scores);
    all.push(...scores);
    console.log(
      `| ${golden.id} | ${golden.kind} | ${mean.toFixed(2)} | ${sd.toFixed(2)} | ${reason.replace(/\|/g, "/").slice(0, 90)} |`,
    );
  }
});
const { mean, sd } = stats(all);
console.log(
  `\nMean ${mean.toFixed(2)}, SD ${sd.toFixed(2)} over ${all.length} scored answers`,
);
await close();

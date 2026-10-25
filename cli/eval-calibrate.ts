import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { close } from "@/lib/db";
import { Golden, type Reply, answer, judge } from "@/lib/eval";
import { modelFor } from "@/lib/routing";
import { systemPrompt } from "@/lib/system-prompt";
import { withTrace } from "@/lib/tracing";

// The judge against a person. --collect writes replies to content/eval/labels.json
// for a person to score by hand; without it, the judge scores the labeled
// replies and the agreement rate is reported: a judge's score within 0.25 of
// the person's agrees. Usage: pnpm eval:calibrate [--collect 20]
const { values } = parseArgs({
  options: { collect: { type: "string" } },
});
const file = "content/eval/labels.json";
const Label = z.object({
  id: z.string(),
  question: z.string(),
  criteria: z.array(z.string()),
  reply: z.object({ text: z.string(), tools: z.array(z.string()) }),
  human: z.number().min(0).max(1).nullable(),
  note: z.string().optional(),
});
type Label = z.infer<typeof Label>;
const golden = z
  .array(Golden)
  .parse(JSON.parse(await readFile("content/eval/golden.json", "utf8")));

if (values.collect) {
  // Round-robin over the kinds, so the labels cover refusals and actions as well as answers.
  const byKind = Map.groupBy(golden, (c) => c.kind);
  const picked: Golden[] = [];
  for (let i = 0; picked.length < Number(values.collect); i++) {
    for (const cases of byKind.values())
      if (cases[i] && picked.length < Number(values.collect))
        picked.push(cases[i]);
    if (i > golden.length) break;
  }
  const labels: Label[] = [];
  for (const c of picked) {
    const reply: Reply = await withTrace(
      { caller: "eval", name: "calibrate" },
      () => answer(c, systemPrompt, modelFor("chat")),
    );
    labels.push({
      id: c.id,
      question: c.question,
      criteria: c.criteria,
      reply,
      human: null,
    });
  }
  await writeFile(file, `${JSON.stringify(labels, null, 2)}\n`);
  console.log(
    `${labels.length} replies in ${file}; score each under "human" before calibrating`,
  );
} else {
  const labels = z
    .array(Label)
    .parse(JSON.parse(await readFile(file, "utf8")))
    .filter((l): l is Label & { human: number } => l.human !== null);
  console.log("| Case | Person | Judge | Agree | Judge's reason |");
  console.log("| --- | --- | --- | --- | --- |");
  let agreed = 0;
  let gap = 0;
  for (const label of labels) {
    const c = golden.find((g) => g.id === label.id);
    if (!c) throw new Error(`No case ${label.id}`);
    const verdict = await withTrace({ caller: "eval", name: "judge" }, () =>
      judge(c, label.reply, modelFor("judge")),
    );
    const agree = Math.abs(verdict.score - label.human) <= 0.25;
    if (agree) agreed++;
    gap += verdict.score - label.human;
    console.log(
      `| ${label.id} | ${label.human.toFixed(2)} | ${verdict.score.toFixed(2)} | ${agree ? "yes" : "no"} | ${verdict.reason.replace(/\|/g, "/").slice(0, 80)} |`,
    );
  }
  console.log(
    `\nAgreement ${agreed} of ${labels.length} (${Math.round((100 * agreed) / labels.length)}%); the judge scores ${(gap / labels.length).toFixed(2)} above the person on average`,
  );
}
await close();

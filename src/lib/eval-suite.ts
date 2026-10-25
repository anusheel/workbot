import { readFile } from "node:fs/promises";
import type { LanguageModel } from "ai";
import type { Browser } from "playwright-core";
import { z } from "zod";
import {
  Golden,
  IntakeCase,
  type Verdict,
  answer,
  judge,
  triageScore,
} from "./eval";
import { documentCases, extractionResult } from "./eval-documents";
import { triage } from "./intake";
import { currentContext, withTrace } from "./tracing";

export const evalTasks = ["chat", "extract", "triage", "security"] as const;
export type EvalTask = (typeof evalTasks)[number];

/** One case of a task: scored on a model, with the reason and the checks it failed outright. */
export type Case = {
  id: string;
  kind: string;
  smoke: boolean;
  run(model: LanguageModel): Promise<Verdict>;
};

const json = async <T>(schema: z.ZodType<T>, path: string) =>
  schema.parse(JSON.parse(await readFile(path, "utf8")));

/** The golden cases under a prompt, each answered by the model and scored by the judge, whose calls are traced under their own name. */
export async function chatSuite(
  prompt: string,
  judgeModel: LanguageModel,
): Promise<Case[]> {
  const cases = await json(z.array(Golden), "content/eval/golden.json");
  return cases.map((golden) => ({
    id: golden.id,
    kind: golden.kind,
    smoke: golden.smoke,
    run: async (model) => {
      const reply = await answer(golden, prompt, model);
      return withTrace({ ...currentContext(), name: "judge" }, () =>
        judge(golden, reply, judgeModel),
      );
    },
  }));
}

/** The eval documents, each classified and extracted: the share of expected fields that came out right, 0 when the kind was wrong. */
export async function extractSuite(browser: Browser): Promise<Case[]> {
  return (await documentCases(browser)).map((c) => ({
    id: c.name,
    kind: c.want.type,
    smoke: c.smoke,
    run: async (model) => {
      const { type, wrong } = await extractionResult(c, model);
      const fields = Object.keys(c.want.data).length;
      if (type !== c.want.type)
        return {
          score: 0,
          reason: `classified as ${type}`,
          violations: [`classified as ${type}`],
        };
      return {
        score: (fields - wrong.length) / fields,
        reason: wrong.length ? `wrong: ${wrong.join(", ")}` : "every field",
        violations: [],
      };
    },
  }));
}

/** The triage cases: the team and the priority the model files each under. */
export async function triageSuite(): Promise<Case[]> {
  const cases = await json(z.array(IntakeCase), "content/eval/intake.json");
  return cases.map((c) => ({
    id: c.id,
    kind: c.team,
    smoke: c.smoke,
    run: async (model) => {
      const got = await triage(c.message, model);
      return {
        score: triageScore(c, got),
        reason: `${got.team}, ${got.priority}`,
        violations: [],
      };
    },
  }));
}

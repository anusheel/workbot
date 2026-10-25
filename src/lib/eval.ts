import { type LanguageModel, Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { chatToolsFor } from "./chat";
import type { Triage } from "./intake";
import { priorities, teams } from "./requests";

/** Where a case came from: written by hand, sampled from what people sent, or generated from a document and reviewed. */
export const sources = ["golden", "trace", "synthetic"] as const;

/**
 * A golden case: a question, what a good answer must do, call and not say,
 * where the case came from, and whether every pull request runs it.
 */
export const Golden = z.object({
  id: z.string(),
  kind: z.enum(["answer", "refusal", "escalation", "action", "safety"]),
  question: z.string(),
  criteria: z.array(z.string()).min(1),
  mustNotContain: z
    .array(z.string().refine((phrase) => phrase !== "", "an empty phrase"))
    .default([]),
  mustCall: z.array(z.string()).default([]),
  source: z.enum(sources).default("golden"),
  smoke: z.boolean().default(false),
});
export type Golden = z.infer<typeof Golden>;

/** A triage case: a message, and the team and priority it belongs to. */
export const IntakeCase = z.object({
  id: z.string(),
  message: z.string(),
  team: z.enum(teams),
  priority: z.enum(priorities),
  source: z.enum(sources).default("golden"),
  smoke: z.boolean().default(false),
});
export type IntakeCase = z.infer<typeof IntakeCase>;

/** What the assistant answered, and the tools it called on the way. */
export type Reply = { text: string; tools: string[] };

/** A score from 0 to 1 with its reason, and the checks failed outright, which make the score 0 whatever a judge would say. */
export type Verdict = { score: number; reason: string; violations: string[] };

/** The assistant's answer to a case, with its tools, under the prompt under test. */
export async function answer(
  golden: Golden,
  prompt: string,
  model: LanguageModel,
): Promise<Reply> {
  const { text, steps } = await generateText({
    model,
    instructions: prompt,
    prompt: golden.question,
    tools: chatToolsFor("public"),
    stopWhen: isStepCount(6),
  });
  return {
    text,
    tools: steps.flatMap((step) => step.toolCalls.map((call) => call.toolName)),
  };
}

const Scored = z.object({
  score: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "1 when every criterion is met, 0 when none is, in between otherwise",
    ),
  reason: z.string().describe("one sentence on what was met and what was not"),
});

/**
 * The judge. The checks that need no model run first, and a failed one is a
 * 0: a forbidden phrase in the answer, a tool that had to be called and was
 * not. Then a model scores the answer against the case's criteria.
 */
export async function judge(
  golden: Golden,
  reply: Reply,
  model: LanguageModel,
): Promise<Verdict> {
  const violations = [
    ...golden.mustNotContain
      .filter(
        (phrase) =>
          phrase !== "" &&
          reply.text.toLowerCase().includes(phrase.toLowerCase()),
      )
      .map((phrase) => `contains ${phrase}`),
    ...golden.mustCall
      .filter((tool) => !reply.tools.includes(tool))
      .map((tool) => `did not call ${tool}`),
  ];
  if (violations.length)
    return { score: 0, reason: violations.join("; "), violations };
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Scored }),
    instructions:
      "You grade an assistant's answer against criteria. Judge only what the answer says. Be strict: a criterion is met only when the answer plainly does what it asks.",
    prompt: `Question: ${golden.question}\n\nAnswer:\n${reply.text}\n\nCriteria:\n${golden.criteria.map((c) => `- ${c}`).join("\n")}`,
  });
  return { ...output, violations };
}

/** How much of a triage was right: the team and the priority, half each. */
export const triageScore = (
  want: IntakeCase,
  got: Pick<Triage, "team" | "priority">,
) =>
  ((want.team === got.team ? 1 : 0) +
    (want.priority === got.priority ? 1 : 0)) /
  2;

/** Mean, standard deviation and standard error of a set of scores: a model's answers vary, so one run is not a result. */
export function stats(scores: number[]) {
  if (!scores.length) return { mean: 0, sd: 0, se: 0, count: 0 };
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const sd = Math.sqrt(variance);
  return { mean, sd, se: sd / Math.sqrt(scores.length), count: scores.length };
}

/** The smallest difference between 2 runs of `count` scores each that is not noise, at 95% confidence. */
export const detectable = (sd: number, count: number) =>
  count ? 1.96 * sd * Math.sqrt(2 / count) : 0;

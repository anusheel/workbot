import { type LanguageModel, Output, generateText, isStepCount } from "ai";
import { z } from "zod";
import { chatTools } from "./chat";

/** A golden case: a question, what a good answer must do, and what it must not say. */
export const Golden = z.object({
  id: z.string(),
  kind: z.enum(["answer", "refusal", "escalation"]),
  question: z.string(),
  criteria: z.array(z.string()).min(1),
  mustNotContain: z
    .array(z.string().refine((phrase) => phrase !== "", "an empty phrase"))
    .default([]),
});
export type Golden = z.infer<typeof Golden>;

export type Score = { score: number; reason: string; violations: string[] };

/** The assistant's answer to a case, with its tools, under the prompt under test. */
export async function answer(
  golden: Golden,
  prompt: string,
  model: LanguageModel,
): Promise<string> {
  const { text } = await generateText({
    model,
    instructions: prompt,
    prompt: golden.question,
    tools: chatTools,
    stopWhen: isStepCount(6),
  });
  return text;
}

const Verdict = z.object({
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
 * The judge: a model scores the answer against the case's criteria. The
 * programmatic check runs first: a forbidden phrase is a 0, whatever the
 * judge thinks.
 */
export async function judge(
  golden: Golden,
  reply: string,
  model: LanguageModel,
): Promise<Score> {
  const violations = golden.mustNotContain.filter(
    (phrase) =>
      phrase !== "" && reply.toLowerCase().includes(phrase.toLowerCase()),
  );
  if (violations.length)
    return {
      score: 0,
      reason: `Contains ${violations.join(", ")}.`,
      violations,
    };
  const { output } = await generateText({
    model,
    output: Output.object({ schema: Verdict }),
    instructions:
      "You grade an assistant's answer against criteria. Judge only what the answer says. Be strict: a criterion is met only when the answer plainly does what it asks.",
    prompt: `Question: ${golden.question}\n\nAnswer:\n${reply}\n\nCriteria:\n${golden.criteria.map((c) => `- ${c}`).join("\n")}`,
  });
  return { ...output, violations };
}

/** Mean and standard deviation of a set of scores: a model's answers vary, so one run is not a result. */
export function stats(scores: number[]) {
  if (!scores.length) return { mean: 0, sd: 0, count: 0 };
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance =
    scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  return { mean, sd: Math.sqrt(variance), count: scores.length };
}

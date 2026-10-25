import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { type Golden, judge, stats } from "./eval";

const golden: Golden = {
  id: "refund-limit",
  kind: "answer",
  question: "How much can a support agent refund alone?",
  criteria: ["States $200 per order", "Names the refunds policy as the source"],
  mustNotContain: ["$500"],
};
const judgeModel = (score: number) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        { type: "text", text: JSON.stringify({ score, reason: "Both met." }) },
      ],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });

test("a forbidden phrase scores 0 before the judge is asked; otherwise the judge's score stands", async () => {
  expect(
    await judge(
      golden,
      "Up to $500 per order (Customer refunds).",
      judgeModel(1),
    ),
  ).toMatchObject({
    score: 0,
    violations: ["$500"],
  });
  expect(
    await judge(
      golden,
      "Up to $200 per order (Customer refunds).",
      judgeModel(1),
    ),
  ).toMatchObject({
    score: 1,
    reason: "Both met.",
    violations: [],
  });
});

test("stats give the mean and the spread", () => {
  expect(stats([1, 1, 1])).toEqual({ mean: 1, sd: 0 });
  expect(stats([1, 0]).mean).toBe(0.5);
  expect(stats([1, 0]).sd).toBe(0.5);
});

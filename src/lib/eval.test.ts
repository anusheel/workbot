import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { Golden, detectable, judge, stats } from "./eval";

const golden = Golden.parse({
  id: "refund-limit",
  kind: "answer",
  question: "How much can a support agent refund alone?",
  criteria: ["States $200 per order", "Names the refunds policy as the source"],
  mustNotContain: ["$500"],
});
const said = (text: string, tools: string[] = []) => ({ text, tools });
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
      said("Up to $500 per order (Customer refunds)."),
      judgeModel(1),
    ),
  ).toEqual({
    score: 0,
    reason: "contains $500",
    violations: ["contains $500"],
  });
  expect(
    await judge(
      golden,
      said("Up to $200 per order (Customer refunds)."),
      judgeModel(1),
    ),
  ).toEqual({ score: 1, reason: "Both met.", violations: [] });
});

test("a tool the case requires is checked, not judged", async () => {
  const action = Golden.parse({
    id: "percent",
    kind: "action",
    question: "What is 18% of 2,450?",
    criteria: ["States 441"],
    mustCall: ["calculator"],
  });
  expect(await judge(action, said("441."), judgeModel(1))).toMatchObject({
    score: 0,
    violations: ["did not call calculator"],
  });
  expect(
    await judge(action, said("441.", ["calculator"]), judgeModel(1)),
  ).toMatchObject({ score: 1, violations: [] });
});

test("a case defaults to a hand-written one outside the smoke subset", () => {
  expect(golden).toMatchObject({
    source: "golden",
    smoke: false,
    mustCall: [],
  });
});

test("stats give the mean, the spread and the standard error", () => {
  expect(stats([1, 1, 1])).toEqual({ mean: 1, sd: 0, se: 0, count: 3 });
  expect(stats([1, 0])).toMatchObject({ mean: 0.5, sd: 0.5 });
  expect(stats([1, 0]).se).toBeCloseTo(0.354, 3);
  expect(stats([])).toEqual({ mean: 0, sd: 0, se: 0, count: 0 });
});

test("the detectable change shrinks with the square root of the case count", () => {
  expect(detectable(0.25, 28)).toBeCloseTo(0.131, 3);
  expect(detectable(0.25, 112)).toBeCloseTo(0.065, 3);
  expect(detectable(0.25, 0)).toBe(0);
});

test("an empty forbidden phrase cannot enter the golden file and is ignored by the judge", async () => {
  expect(() => Golden.parse({ ...golden, mustNotContain: [""] })).toThrow();
  expect(
    await judge(
      { ...golden, mustNotContain: [""] },
      said("Up to $200 per order."),
      judgeModel(1),
    ),
  ).toMatchObject({ score: 1, violations: [] });
});

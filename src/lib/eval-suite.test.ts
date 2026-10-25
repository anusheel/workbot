import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { chatSuite, triageSuite } from "./eval-suite";

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};
const saying = (text: string) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });

test("a triage case scores the team and the priority, half each", async () => {
  const suite = await triageSuite();
  const c = suite.find((c) => c.id === "van-breakdown")!;
  expect(c).toMatchObject({ kind: "operations" });
  const filed = saying(
    JSON.stringify({
      title: "Tow van 3",
      body: "Van 3 broke down on the 880.",
      team: "operations",
      priority: "normal",
    }),
  );
  expect(await c.run(filed)).toEqual({
    score: 0.5,
    reason: "operations, normal",
    violations: [],
  });
});

test("a chat case answers under the prompt and is scored by the judge", async () => {
  const suite = await chatSuite(
    "Be brief.",
    saying('{"score":1,"reason":"Met."}'),
  );
  const c = suite.find((c) => c.id === "refund-limit")!;
  expect(await c.run(saying("Up to $200 per order (Refunds)."))).toEqual({
    score: 1,
    reason: "Met.",
    violations: [],
  });
  expect(await c.run(saying("Up to $500 per order."))).toMatchObject({
    score: 0,
    violations: ["contains $500"],
  });
});

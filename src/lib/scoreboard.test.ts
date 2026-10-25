import { expect, test } from "vitest";
import { type Run, frameworkSummary, margin } from "./scoreboard";

test("the framework table of the document is read into one row per framework, as means", () => {
  const markdown = `| Topic | Framework | Time | Tool calls | Tokens in / out | Cost | Findings |
| --- | --- | --- | --- | --- | --- | --- |
| refunds | langgraph | 28 s | 18 | 33365 / 5043 | $0.006 | 5 |
| shipping | langgraph | 18 s | 14 | 17288 / 3060 | $0.004 | 5 |
| refunds | openai | 17 s | 16 | 24280 / 2425 | $0.004 | 4 |`;
  expect(frameworkSummary(markdown)).toEqual([
    {
      framework: "langgraph",
      topics: 2,
      seconds: 23,
      calls: 16,
      tokensIn: 25327,
      dollars: 0.005,
    },
    {
      framework: "openai",
      topics: 1,
      seconds: 17,
      calls: 16,
      tokensIn: 24280,
      dollars: 0.004,
    },
  ]);
  expect(frameworkSummary("no table here")).toEqual([]);
});

test("a run's margin narrows with cases and runs", () => {
  const run = { sd: 0.25, cases: 10, runs: 2 } as Run;
  expect(margin(run)).toBeCloseTo(0.11, 2);
  expect(margin({ ...run, cases: 40 })).toBeCloseTo(0.055, 3);
});

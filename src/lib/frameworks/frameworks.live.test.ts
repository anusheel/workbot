import { expect, test } from "vitest";
import { frameworkNames, frameworks } from "./index";

const topic =
  "What is the refund policy for a damaged item, and who approves a refund above the usual limit?";

// The same question on each framework, on the small model, against the knowledge base.
for (const name of frameworkNames)
  test(`${name} researches the refund policy and writes a sourced report`, async () => {
    const run = await frameworks[name](topic);
    expect(run.report.length).toBeGreaterThan(80);
    expect(run.findings.length).toBeGreaterThan(0);
    expect(run.toolCalls).toBeGreaterThan(1);
    expect(run.usage.input).toBeGreaterThan(0);
    expect(run.dollars).toBeGreaterThan(0);
  });

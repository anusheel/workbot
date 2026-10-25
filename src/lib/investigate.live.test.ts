import { expect, test } from "vitest";
import { chatModel } from "./chat";
import { investigate } from "./investigate";

test("the agent reads the knowledge base and writes a sourced report on the small model", async () => {
  const calls: string[] = [];
  const run = await investigate(
    "A customer wants a $250 refund on an order delivered 10 days ago. Can the support agent approve it alone?",
    chatModel("small"),
    { tool: (call) => calls.push(call.name) },
    { steps: 10, dollars: 0.1, seconds: 150 },
  );
  expect(["find", "grep", "ls"]).toContain(calls[0]);
  expect(calls).toContain("write_report");
  expect(run.stopped).toBe("answered");
  expect(run.findings.length).toBeGreaterThan(0);
  expect(run.report).toMatch(/\$200/);
  expect(run.report).toMatch(/refund/i);
});

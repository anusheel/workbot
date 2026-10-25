import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { investigate } from "./investigate";

type Call = { name: string; input: unknown };
const scripted = (turns: Call[][]) =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      const calls = turns.shift() ?? [];
      return {
        content: calls.map((call, i) => ({
          type: "tool-call" as const,
          toolCallId: `c${turns.length}-${i}`,
          toolName: call.name,
          input: JSON.stringify(call.input),
        })),
        finishReason: {
          unified: calls.length ? ("tool-calls" as const) : ("stop" as const),
          raw: undefined,
        },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });

test("explores the knowledge base, saves findings and writes the report", async () => {
  const seen: string[] = [];
  const model = scripted([
    [{ name: "find", input: { query: "refund damaged order" } }],
    [{ name: "cat", input: { path: "policies/refunds" } }],
    [
      {
        name: "save_finding",
        input: {
          text: "Agents may refund up to $200 per order.",
          source: "Customer refunds",
        },
      },
    ],
    [
      {
        name: "write_report",
        input: {
          report: "Agents may refund up to $200 per order [Customer refunds].",
        },
      },
    ],
  ]);
  const result = await investigate("Can an agent refund $250?", model, {
    tool: (c) => seen.push(`${c.name}${c.failed ? "!" : ""}`),
  });
  expect(seen).toEqual(["find", "cat", "save_finding", "write_report"]);
  expect(result.findings).toEqual([
    {
      text: "Agents may refund up to $200 per order.",
      source: "Customer refunds",
    },
  ]);
  expect(result.report).toBe(
    "Agents may refund up to $200 per order [Customer refunds].",
  );
  expect(result.stopped).toBe("answered");
});

test("a missing document is an error the model can recover from, and a cut-off run reports its findings", async () => {
  const seen: string[] = [];
  const model = scripted([
    [{ name: "cat", input: { path: "policies/nope" } }],
    [
      {
        name: "save_finding",
        input: { text: "Nothing covers this.", source: "Knowledge base" },
      },
    ],
  ]);
  const result = await investigate(
    "Anything?",
    model,
    { tool: (c) => seen.push(`${c.name}${c.failed ? "!" : ""}`) },
    { steps: 2 },
  );
  expect(seen).toEqual(["cat!", "save_finding"]);
  expect(result.stopped).toBe("steps");
  expect(result.report).toContain(
    "Findings so far:\n- Nothing covers this. [Knowledge base]",
  );
});

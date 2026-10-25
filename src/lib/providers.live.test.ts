import { expect, test } from "vitest";
import { anthropic } from "./providers";
import { calculator } from "./tools";

test("the small Anthropic model streams a reply and reports its usage", async () => {
  let text = "";
  const usage = await anthropic().stream(
    {
      model: "claude-haiku-5-5",
      system: "Answer in one word.",
      messages: [
        { role: "user", content: "What colour is a clear daytime sky?" },
      ],
      maxTokens: 20,
    },
    { text: (delta) => (text += delta) },
  );
  expect(text.toLowerCase()).toContain("blue");
  expect(usage.input).toBeGreaterThan(0);
  expect(usage.output).toBeGreaterThan(0);
});

test("the small model calls the calculator and answers with its result", async () => {
  const calls: string[] = [];
  let text = "";
  await anthropic().stream(
    {
      model: "claude-haiku-5-5",
      system:
        "Use the calculator for any arithmetic. Answer with the number only.",
      messages: [{ role: "user", content: "What is 1234 * 5678?" }],
      maxTokens: 200,
      tools: [calculator],
    },
    { text: (delta) => (text += delta), tool: (call) => calls.push(call.name) },
  );
  expect(calls).toEqual(["calculator"]);
  expect(text.replace(/,/g, "")).toContain("7006652");
});

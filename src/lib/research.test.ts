import { expect, test } from "vitest";
import type { Completion, Provider } from "./providers";
import { research } from "./research";

// A provider that answers from a script, and remembers what it was asked.
function scripted(replies: string[]): Provider & { asked: Completion[] } {
  const asked: Completion[] = [];
  return {
    name: "anthropic",
    asked,
    models: [
      { id: "large", size: "large" },
      { id: "small", size: "small" },
    ],
    async stream(completion, on) {
      asked.push(completion);
      on.text(replies.shift() ?? "");
      return { input: 10, output: 5 };
    },
  };
}

test("reads the chosen policies, extracts notes with a large model and answers with citations", async () => {
  const provider = scripted([
    '{"policies": ["refunds", "support-sla"], "queries": []}',
    "- Agents may refund up to $200 per order",
    "- Urgent tickets get a first response within 1 hour",
    "Agents can refund up to $200 [1]. Urgent tickets are answered within 1 hour [2].\n\n[1] Customer refunds\n[2] Support response times",
  ]);
  const steps: string[] = [];
  const spent: string[] = [];
  let streamed = "";
  const result = await research("What can an agent refund?", provider, {
    step: (m) => steps.push(m),
    text: (t) => (streamed += t),
    spend: (model) => spent.push(model.id),
  });

  expect(steps).toEqual([
    "Choosing sources",
    "Reading 2 sources",
    "Writing the answer",
  ]);
  expect(result.sources.map((s) => s.title)).toEqual([
    "Customer refunds",
    "Support response times",
  ]);
  expect(result.answer).toContain("[1] Customer refunds");
  expect(result.answer).toBe(streamed);
  expect(result.usage).toEqual({ input: 40, output: 20 });
  expect(spent).toEqual(["small", "large", "large", "large"]);

  const [plan, note1, , answer] = provider.asked;
  expect(plan.model).toBe("small");
  expect(note1.model).toBe("large");
  expect(note1.messages[0].content).toContain("Source [1] Customer refunds");
  expect(answer.messages[0].content).toContain("[1] Customer refunds");
});

test("asks again when the plan is not valid JSON, then gives up", async () => {
  const provider = scripted([
    "I would read the refunds policy.",
    '{"policies": ["refunds"], "queries": []}',
    "- nothing",
    "No answer.",
  ]);
  await research("Anything?", provider, { step: () => {}, text: () => {} });
  expect(provider.asked[1].messages.at(-1)?.content).toMatch(
    /^That is not valid/,
  );

  const stubborn = scripted(["no", "still no"]);
  await expect(
    research("Anything?", stubborn, { step: () => {}, text: () => {} }),
  ).rejects.toThrow("not valid JSON");
});

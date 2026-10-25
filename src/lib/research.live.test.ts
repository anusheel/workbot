import { expect, test } from "vitest";
import { anthropic } from "./providers";
import { research } from "./research";

// The small model in both roles, so the live check stays cheap.
const small = {
  ...anthropic(),
  models: [
    { id: "claude-haiku-5-5", size: "large" as const },
    { id: "claude-haiku-5-5", size: "small" as const },
  ],
};

test("research answers a policy question from the documents, with a citation", async () => {
  const steps: string[] = [];
  const { answer, sources } = await research(
    "How much can a support agent refund without approval?",
    small,
    { step: (message) => steps.push(message), text: () => {} },
  );
  expect(sources.map((s) => s.title)).toContain("Customer refunds");
  expect(answer).toMatch(/\$200/);
  expect(answer).toMatch(/\[1\]/);
  expect(steps[0]).toBe("Choosing sources");
});

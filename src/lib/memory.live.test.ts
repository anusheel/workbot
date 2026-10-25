import { expect, test } from "vitest";
import { modelFor } from "./routing";
import { extractMemories } from "./memory";

test("the small model extracts a durable fact about the person, and nothing about the answer", async () => {
  const memories = await extractMemories(
    modelFor("extract"),
    {
      user: "I manage vendor onboarding for the finance team. What is the net payment term for new vendors?",
      assistant: "The vendor onboarding policy sets net 30 for new vendors.",
    },
    [],
  );
  expect(memories.length).toBeGreaterThan(0);
  expect(memories.every((m) => /person/i.test(m.text))).toBe(true);
  expect(memories.some((m) => /finance|vendor/i.test(m.text))).toBe(true);
});

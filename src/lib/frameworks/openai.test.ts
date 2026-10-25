import { expect, test } from "vitest";
import { openai, refused, remit } from "./openai";

test("a topic outside the remit is refused before any model call", async () => {
  const error = await openai("What is the capital of France?", {
    model: "claude-haiku-5-5",
  }).catch((e: unknown) => e);
  expect(refused(error)).toBe(true);
});

test("the remit names what the desk researches", () => {
  expect(remit).toContain("refund");
  expect(remit).not.toContain("capital");
});

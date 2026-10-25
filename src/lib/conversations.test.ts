import type { UIMessage } from "ai";
import { expect, test } from "vitest";
import { titleOf, upsert } from "./conversations";

const ask = (text: string): UIMessage[] => [
  { id: "u", role: "user", parts: [{ type: "text", text }] },
];

test("a conversation is titled by its first question, shortened", () => {
  expect(titleOf(ask("What is the meal limit?"))).toBe(
    "What is the meal limit?",
  );
  expect(titleOf(ask("x".repeat(60)))).toBe(`${"x".repeat(47)}…`);
  expect(titleOf([])).toBe("New chat");
});

test("upsert keeps the title, replaces the messages and moves the conversation to the front", () => {
  const first = upsert([], "a", ask("First question"), 1);
  const second = upsert(first, "b", ask("Second question"), 2);
  expect(second.map((c) => c.id)).toEqual(["b", "a"]);
  const updated = upsert(
    second,
    "a",
    [...ask("First question"), { id: "r", role: "assistant", parts: [] }],
    3,
  );
  expect(updated.map((c) => c.id)).toEqual(["a", "b"]);
  expect(updated[0]).toMatchObject({ title: "First question", updatedAt: 3 });
  expect(updated[0].messages).toHaveLength(2);
});

import type { UIMessage } from "ai";
import { afterEach, expect, test, vi } from "vitest";
import {
  type Conversation,
  getConversations,
  saveConversations,
  titleOf,
  upsert,
} from "./conversations";

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

// A localStorage that is full above `limit` conversations, as a browser's is
// above its quota.
function fakeStorage(limit: number, stored: Record<string, string> = {}) {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored[key] ?? null,
    setItem: (key: string, value: string) => {
      if (JSON.parse(value).length > limit) throw new Error("QuotaExceeded");
      stored[key] = value;
    },
  });
}

const conversation = (n: number): Conversation => ({
  id: `c${n}`,
  title: `Chat ${n}`,
  updatedAt: n,
  messages: ask(`Question ${n}`),
});

afterEach(() => vi.unstubAllGlobals());

test("a save that does not fit drops the oldest conversations and does not throw", () => {
  fakeStorage(2);
  const newestFirst = [5, 4, 3, 2, 1].map(conversation);
  expect(() => saveConversations(newestFirst)).not.toThrow();
  expect(getConversations().map((c) => c.id)).toEqual(["c5", "c4"]);
});

test("a stored value that is not a list of conversations reads as none", () => {
  for (const raw of ['{"nope":1}', "[1]", '[{"id":"a"}]', "null", "not json"]) {
    fakeStorage(2, { "workbot.conversations": raw });
    expect(getConversations()).toEqual([]);
  }
});

test("stored conversations load as they were saved", () => {
  fakeStorage(2);
  saveConversations([conversation(2), conversation(1)]);
  expect(getConversations()).toEqual([conversation(2), conversation(1)]);
});

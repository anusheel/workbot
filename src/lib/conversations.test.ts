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

// A localStorage that is full above `limit` messages in all, as a browser's is
// above its quota. A refused write leaves what was stored, as a browser's does.
function fakeStorage(limit: number, stored: Record<string, string> = {}) {
  const setItem = vi.fn((key: string, value: string) => {
    const list: Conversation[] = JSON.parse(value);
    if (list.reduce((n, c) => n + c.messages.length, 0) > limit) {
      throw new Error("QuotaExceeded");
    }
    stored[key] = value;
  });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored[key] ?? null,
    setItem,
  });
  return { stored, setItem };
}

// One message each, unless it is given more.
const conversation = (n: number, messages = 1): Conversation => ({
  id: `c${n}`,
  title: `Chat ${n}`,
  updatedAt: n,
  messages: Array.from({ length: messages }, (_, i) => ({
    id: `m${i}`,
    role: "user" as const,
    parts: [{ type: "text" as const, text: `Question ${n}` }],
  })),
});

const ids = () => getConversations().map((c) => c.id);

afterEach(() => vi.unstubAllGlobals());

test("a save that does not fit drops the oldest conversations and does not throw", () => {
  fakeStorage(2);
  const newestFirst = [5, 4, 3, 2, 1].map((n) => conversation(n));
  expect(() => saveConversations(newestFirst)).not.toThrow();
  expect(ids()).toEqual(["c5", "c4"]);
});

test("a newest chat that alone does not fit leaves the stored chats as they were", () => {
  const { stored } = fakeStorage(3);
  saveConversations([3, 2, 1].map((n) => conversation(n)));
  const before = stored["workbot.conversations"];
  expect(() =>
    saveConversations([conversation(3, 4), conversation(2), conversation(1)]),
  ).not.toThrow();
  expect(stored["workbot.conversations"]).toBe(before);
  expect(ids()).toEqual(["c3", "c2", "c1"]);
});

test("a save that refuses every write does not try once per conversation", () => {
  const { setItem } = fakeStorage(0);
  const many = Array.from({ length: 200 }, (_, i) => conversation(200 - i));
  expect(() => saveConversations(many)).not.toThrow();
  expect(setItem.mock.calls.length).toBeLessThan(20);
});

test("a long list keeps exactly the newest conversations that fit", () => {
  const { setItem } = fakeStorage(37);
  const many = Array.from({ length: 200 }, (_, i) => conversation(200 - i));
  saveConversations(many);
  expect(getConversations()).toEqual(many.slice(0, 37));
  expect(setItem.mock.calls.length).toBeLessThan(20);
});

test("a stored value that is not a list of conversations reads as none", () => {
  for (const raw of ['{"nope":1}', "[1]", '[{"id":"a"}]', "null", "not json"]) {
    fakeStorage(2, { "workbot.conversations": raw });
    expect(getConversations()).toEqual([]);
  }
});

test("one malformed conversation does not hide the others, and the next save keeps them", () => {
  const bad = { id: "old", title: "t", messages: [] };
  const raw = JSON.stringify([conversation(3), bad, conversation(1)]);
  fakeStorage(10, { "workbot.conversations": raw });
  expect(ids()).toEqual(["c3", "c1"]);
  saveConversations(upsert(getConversations(), "n", ask("New question")));
  expect(ids()).toEqual(["n", "c3", "c1"]);
});

test("a conversation whose messages the page could not render is left out", () => {
  for (const messages of [
    [1, null, {}],
    [{ id: "m", role: "robot", parts: [] }],
    [{ id: "m", role: "user" }],
    [{ id: "m", role: "user", parts: [null] }],
  ]) {
    const unrenderable = { id: "a", title: "t", updatedAt: 1, messages };
    const raw = JSON.stringify([unrenderable, conversation(1)]);
    fakeStorage(10, { "workbot.conversations": raw });
    expect(ids()).toEqual(["c1"]);
  }
});

test("stored conversations load as they were saved", () => {
  fakeStorage(2);
  saveConversations([conversation(2), conversation(1)]);
  expect(getConversations()).toEqual([conversation(2), conversation(1)]);
});

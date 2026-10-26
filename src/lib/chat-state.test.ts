import { expect, test } from "vitest";
import { databaseState } from "./chat-state";
import { query } from "./db";

const state = databaseState();
const expire = (key: string) =>
  query(
    `update chat_state set expires_at = now() - interval '1 second' where key = $1`,
    [key],
  );

test("a thread is followed until it is let go", async () => {
  expect(await state.isSubscribed("slack:C1:1")).toBe(false);
  await state.subscribe("slack:C1:1");
  expect(await state.isSubscribed("slack:C1:1")).toBe(true);
  await state.unsubscribe("slack:C1:1");
  expect(await state.isSubscribed("slack:C1:1")).toBe(false);
});

test("one holder at a time per thread: a lock is refused while held, extended only by its holder, and free once expired", async () => {
  const lock = await state.acquireLock("t-1", 30_000);
  expect(lock).not.toBeNull();
  expect(await state.acquireLock("t-1", 30_000)).toBeNull();
  expect(
    await state.extendLock({ ...lock!, token: "someone else" }, 30_000),
  ).toBe(false);
  expect(await state.extendLock(lock!, 30_000)).toBe(true);
  await state.releaseLock({ ...lock!, token: "someone else" });
  expect(await state.acquireLock("t-1", 30_000)).toBeNull();
  await expire("lock:t-1");
  expect(await state.extendLock(lock!, 30_000)).toBe(false);
  const next = await state.acquireLock("t-1", 30_000);
  expect(next?.token).not.toBe(lock!.token);
  await state.releaseLock(next!);
  expect(await state.acquireLock("t-1", 30_000)).not.toBeNull();
});

test("a key set only when absent dedupes a delivery, and an expired value reads as nothing", async () => {
  expect(await state.setIfNotExists("dedupe:E1", 1, 60_000)).toBe(true);
  expect(await state.setIfNotExists("dedupe:E1", 1, 60_000)).toBe(false);
  await state.set("cache:k", { a: "text" }, 60_000);
  expect(await state.get("cache:k")).toEqual({ a: "text" });
  await expire("cache:k");
  expect(await state.get("cache:k")).toBeNull();
});

test("a list keeps its newest entries, and a queue gives them back in order", async () => {
  for (const n of [1, 2, 3, 4])
    await state.appendToList("recent", n, { maxLength: 3 });
  expect(await state.getList("recent")).toEqual([2, 3, 4]);
  const entry = (id: string) =>
    ({ enqueuedAt: 1, expiresAt: 2, message: { id } }) as never;
  expect(await state.enqueue("t-2", entry("a"), 10)).toBe(1);
  expect(await state.enqueue("t-2", entry("b"), 10)).toBe(2);
  expect(await state.queueDepth("t-2")).toBe(2);
  expect(await state.dequeue("t-2")).toMatchObject({ message: { id: "a" } });
  expect(await state.dequeue("t-2")).toMatchObject({ message: { id: "b" } });
  expect(await state.dequeue("t-2")).toBeNull();
  expect(await state.dequeue("t-3")).toBeNull();
});

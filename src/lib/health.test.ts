import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("./db");
  vi.resetModules();
});

// The embedded database takes longer than the 2 second limit to answer its
// first query on a cold CI runner, so no test here depends on a real one.
async function healthWith(query: () => Promise<unknown>) {
  vi.resetModules();
  vi.doMock("./db", () => ({ query }));
  return (await import("./health")).health;
}

test("reports the database as reachable", async () => {
  const health = await healthWith(async () => ({ rows: [{ "?column?": 1 }] }));
  expect(await health()).toMatchObject({ status: "ok", database: "ok" });
});

test("reports the database unreachable when the query fails", async () => {
  const health = await healthWith(async () => {
    throw new Error("connection refused");
  });
  expect(await health()).toMatchObject({
    status: "degraded",
    database: "unreachable",
  });
});

test("reports the database unreachable within 2 seconds when the query hangs", async () => {
  vi.useFakeTimers();
  const health = await healthWith(() => new Promise(() => {}));
  const report = health();
  await vi.advanceTimersByTimeAsync(2000);
  expect(await report).toMatchObject({
    status: "degraded",
    database: "unreachable",
  });
});

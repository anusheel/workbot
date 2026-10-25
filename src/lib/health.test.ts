import { afterEach, expect, test, vi } from "vitest";
import { health } from "./health";

afterEach(() => {
  vi.useRealTimers();
  vi.doUnmock("./db");
  vi.resetModules();
});

test("reports the database as reachable", async () => {
  expect(await health()).toMatchObject({ status: "ok", database: "ok" });
});

test("reports the database unreachable within 2 seconds when the query hangs", async () => {
  vi.useFakeTimers();
  vi.resetModules();
  vi.doMock("./db", () => ({ query: () => new Promise(() => {}) }));
  const { health: hangingHealth } = await import("./health");
  const report = hangingHealth();
  await vi.advanceTimersByTimeAsync(2000);
  expect(await report).toMatchObject({
    status: "degraded",
    database: "unreachable",
  });
});

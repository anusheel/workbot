import { afterEach, expect, test, vi } from "vitest";
import { allow, bucketCount } from "./rate-limit";

afterEach(() => vi.useRealTimers());

test("a key gets its limit, then waits for the refill", () => {
  const options = { limit: 3, per: 3000, now: 1000 };
  expect([
    allow("k", options),
    allow("k", options),
    allow("k", options),
  ]).toEqual([true, true, true]);
  expect(allow("k", options)).toBe(false);
  expect(allow("k", { ...options, now: 2000 })).toBe(true);
  expect(allow("k", { ...options, now: 2000 })).toBe(false);
  expect(allow("other", options)).toBe(true);
});

test("a bucket is removed on the next call once its window has passed", () => {
  vi.useFakeTimers();
  for (let i = 0; i < 100; i++) allow(`caller-${i}`);
  expect(bucketCount()).toBeGreaterThanOrEqual(100);

  vi.advanceTimersByTime(5 * 60_000);
  allow("late");
  expect(bucketCount()).toBe(1);
});

test("the limit still holds within a window", () => {
  vi.useFakeTimers();
  const results = Array.from({ length: 4 }, () => allow("held", { limit: 3 }));
  vi.advanceTimersByTime(1000);
  allow("other");
  expect(results).toEqual([true, true, true, false]);
  expect(allow("held", { limit: 3 })).toBe(false);
});

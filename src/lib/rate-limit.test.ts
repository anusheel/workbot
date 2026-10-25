import { expect, test } from "vitest";
import { allow } from "./rate-limit";

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

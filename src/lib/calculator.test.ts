import { expect, test } from "vitest";
import { calculate } from "./calculator";

test.each([
  ["2 + 3 * 4", 14],
  ["(2 + 3) * 4", 20],
  ["2 ^ 3 ^ 2", 512],
  ["-3 ^ 2", -9],
  ["10 / 4", 2.5],
  ["17 % 5", 2],
  ["1200 * 0.2 + 35", 275],
  ["((1))", 1],
  ["(-3) ^ 2", 9],
  ["2 ^ -1", 0.5],
])("%s = %d", (expression, expected) => {
  expect(calculate(expression)).toBe(expected);
});

test.each([
  ["2 +", "Unexpected end of expression"],
  ["(2 + 3", "Missing )"],
  ["2 3", "Unexpected 3"],
  ["two + 2", 'Cannot read "two + 2"'],
  ["1 / 0", "not a finite number"],
])("%s is rejected", (expression, message) => {
  expect(() => calculate(expression)).toThrow(message);
});

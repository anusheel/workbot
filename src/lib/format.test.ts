import { describe, expect, it } from "vitest";
import { when } from "./format";

describe("when", () => {
  const now = new Date(2026, 9, 25, 15, 0, 0);

  it("returns only the time for today", () => {
    expect(when(new Date(2026, 9, 25, 9, 5, 7), now)).toBe("09:05:07");
  });

  it("includes the day and month for an earlier day", () => {
    expect(when(new Date(2026, 9, 24, 23, 59, 1), now)).toBe(
      "24 Oct, 23:59:01",
    );
  });
});

import { describe, expect, it } from "vitest";
import { normal, same } from "./field-match";

describe("same", () => {
  it("matches a string that contains the expected text, ignoring case and spacing", () => {
    expect(same("Acme   Supply Co.", "acme supply")).toBe(true);
    expect(same("Acme", "acme supply")).toBe(false);
  });

  it("matches a list that holds every expected item", () => {
    expect(same([{ a: 1 }, { a: 2 }], [{ a: 2 }])).toBe(true);
    expect(same([{ a: 1 }], [{ a: 1 }, { a: 2 }])).toBe(false);
    expect(same("a", ["a"])).toBe(false);
  });

  it("matches nested records on the expected fields only", () => {
    const got = { vendor: { name: "Acme Ltd", city: "Oslo" }, total: 5 };
    expect(same(got, { vendor: { name: "acme" } })).toBe(true);
    expect(same(got, { vendor: { name: "other" } })).toBe(false);
    expect(same(null, { vendor: {} })).toBe(false);
  });

  it("compares numbers for equality", () => {
    expect(same(12.5, 12.5)).toBe(true);
    expect(same(12.5, 12)).toBe(false);
  });

  it("is false when the actual value is undefined", () => {
    expect(same(undefined, "x")).toBe(false);
    expect(same(undefined, 1)).toBe(false);
    expect(same(undefined, { a: 1 })).toBe(false);
  });
});

describe("normal", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normal("  A \n B ")).toBe("a b");
  });
});

import { describe, expect, it, vi } from "vitest";

const unsafe = vi.fn(async () => []);
vi.mock("postgres", () => ({
  default: vi.fn(() => ({ unsafe, end: vi.fn() })),
}));

import { connect } from "./db";

describe("connect", () => {
  it("sends null for an undefined parameter to postgres", async () => {
    const connection = connect("postgres://x");
    await connection.query("select $1", [undefined]);
    expect(unsafe).toHaveBeenCalledWith("select $1", [null]);
  });

  it("returns null for an undefined parameter in the embedded driver", async () => {
    const connection = connect("memory://");
    const rows = await connection.query<{ v: string | null }>(
      "select $1::text as v",
      [undefined],
    );
    expect(rows).toEqual([{ v: null }]);
    await connection.close();
  });
});

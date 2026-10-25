import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const report = vi.hoisted(() => vi.fn());

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/health", () => ({ health: report }));

beforeEach(() => report.mockReset());

test("answers 200 when ok", async () => {
  report.mockResolvedValue({ status: "ok", database: "ok", commit: "abc" });
  expect((await GET()).status).toBe(200);
});

test("answers 503 when degraded", async () => {
  report.mockResolvedValue({
    status: "degraded",
    database: "unreachable",
    commit: "abc",
  });
  expect((await GET()).status).toBe(503);
});

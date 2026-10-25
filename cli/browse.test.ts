import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", "cli/browse.ts", ...args], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "memory://" },
  });

describe("browse cli", () => {
  it("rejects a start URL without a scheme before Chrome launches", () => {
    const r = run("--start", "example.com", "x");
    expect(r.status).toBe(1);
    expect(r.stderr).not.toContain("TypeError");
    expect(r.stderr).toContain("--start");
  });

  it("rejects a start URL with another scheme", () => {
    expect(run("--start", "ftp://example.com", "x").status).toBe(1);
  });

  it("prints usage and exits 0 for --help", () => {
    const r = run("--help");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Usage: pnpm browse");
  });
});

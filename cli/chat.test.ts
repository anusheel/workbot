import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const run = (args: string[], input = "") =>
  spawnSync(process.execPath, ["--import", "tsx", "cli/chat.ts", ...args], {
    input,
    encoding: "utf8",
    timeout: 30_000,
  });

describe("chat cli flags", () => {
  it("rejects a bad provider with the valid values and no stack trace", () => {
    const { status, stderr } = run(["--provider", "nope"]);
    expect(status).toBe(1);
    expect(stderr).toContain("anthropic");
    expect(stderr).toContain("Usage");
    expect(stderr).not.toContain("ZodError");
  });

  it("rejects a bad effort", () => {
    const { status, stderr } = run(["--effort", "extreme"]);
    expect(status).toBe(1);
    expect(stderr).toContain("low, medium, high");
    expect(stderr).not.toContain("ZodError");
  });

  it.each(["abc", "0", "-5", "1.5"])("rejects --max-tokens %s", (value) => {
    const { status, stderr } = run(["--max-tokens", value]);
    expect(status).toBe(1);
    expect(stderr).toContain("max-tokens");
    expect(stderr).not.toContain("NaN");
  });

  it("rejects a temperature that is not a number", () => {
    const { status, stderr } = run(["--temperature", "hot"]);
    expect(status).toBe(1);
    expect(stderr).toContain("temperature");
  });

  it("prints every flag for --help and exits 0", () => {
    const { status, stdout } = run(["--help"]);
    expect(status).toBe(0);
    for (const flag of [
      "--provider",
      "--model",
      "--effort",
      "--temperature",
      "--max-tokens",
      "--help",
    ])
      expect(stdout).toContain(flag);
    expect(stdout).toContain("/help");
  });

  it("answers /model nope with the valid providers", () => {
    const { status, stdout } = run([], "/model nope\n/exit\n");
    expect(status).toBe(0);
    expect(stdout).toContain("anthropic");
    expect(stdout).toContain("nope");
  });
});

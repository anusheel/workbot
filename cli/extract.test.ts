import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { documentTypes } from "@/lib/document-model";
import { mediaTypes } from "@/lib/extract";

const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--import", "tsx", "cli/extract.ts", ...args], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "memory://" },
  });

const email = "content/eval/documents/email-1.txt";

describe("extract cli", () => {
  it("rejects an unknown kind and lists the kinds", () => {
    const result = run(email, "--as", "memo");
    expect(result.status).toBe(1);
    for (const kind of documentTypes) expect(result.stderr).toContain(kind);
    expect(result.stderr).not.toContain("ZodError");
  });

  it("rejects a bad kind before it reads a missing file", () => {
    const result = run("content/eval/documents/none.txt", "--as", "memo");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("memo");
    expect(result.stderr).not.toContain("none.txt");
  });

  it("names a missing path in one line", () => {
    const result = run("content/eval/documents/none.txt");
    expect(result.status).toBe(1);
    expect(result.stderr.trim().split("\n")).toHaveLength(1);
    expect(result.stderr).toContain("content/eval/documents/none.txt");
  });

  it("lists the supported extensions for an unsupported file", () => {
    const result = run("package.json", "--as", "invoice");
    expect(result.status).toBe(1);
    for (const extension of [
      ...Object.keys(mediaTypes),
      ".txt",
      ".md",
      ".eml",
      ".html",
    ])
      expect(result.stderr).toContain(extension);
  });
});

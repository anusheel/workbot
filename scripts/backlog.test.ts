import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const backlog = readFileSync(
  new URL("../docs/backlog.md", import.meta.url),
  "utf8",
);

const headings = [...backlog.matchAll(/^### (WB-\d+) (.+)$/gm)].map(
  (m) => [m[1], m[2].trim()] as const,
);

const rows = new Map(
  [
    ...backlog.matchAll(/^\| (WB-\d+)\s*\| (.*?)\s*\| [SM]\s*\| \w+\s*\|$/gm),
  ].map((m) => [m[1], m[2]] as const),
);

test("every ticket heading has a table row with the same title", () => {
  expect(headings.length).toBeGreaterThan(0);
  for (const [id, title] of headings) {
    expect(rows.get(id), `${id} has no row`).toBe(title);
  }
});

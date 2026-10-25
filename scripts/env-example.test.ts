import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

// Vercel sets these and NODE_ENV comes from the runtime; nobody fills them in.
const provided = (name: string) =>
  name.startsWith("VERCEL_") || name === "NODE_ENV";

test(".env.example lists every variable config.ts reads", () => {
  const used = [...read("src/lib/config.ts").matchAll(/process\.env\.(\w+)/g)]
    .map((m) => m[1])
    .filter((name) => !provided(name));
  // An example is listed uncommented when required, commented when optional.
  const listed = new Set(
    [...read(".env.example").matchAll(/^(?:# )?([A-Z][A-Z0-9_]*)=/gm)].map(
      (m) => m[1],
    ),
  );

  expect(used.length).toBeGreaterThan(0);
  expect(used.filter((name) => !listed.has(name))).toEqual([]);
});

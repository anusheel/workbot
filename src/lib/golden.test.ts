import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { expect, test } from "vitest";
import { Golden } from "./eval";
import { customerSections } from "./knowledge-tools";

const root = "content/knowledge";
const cases = async () =>
  Golden.array().parse(
    JSON.parse(await readFile("content/eval/golden.json", "utf8")),
  );

test("ids are unique and each kind has at least 3 cases", async () => {
  const golden = await cases();
  const ids = golden.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const kind of ["answer", "refusal", "escalation"] as const)
    expect(golden.filter((g) => g.kind === kind).length).toBeGreaterThanOrEqual(
      3,
    );
});

test("every document a criterion names is one the customer tools can read", async () => {
  const unreachable: string[] = [];
  for (const section of await readdir(root)) {
    if (customerSections.includes(section) || section.includes(".")) continue;
    for (const file of await readdir(`${root}/${section}`))
      unreachable.push(file.replace(/\.md$/, "").replaceAll("-", " "));
  }
  const problems: string[] = [];
  for (const { id, criteria } of await cases()) {
    for (const criterion of criteria) {
      for (const [, path] of criterion.matchAll(/`([a-z-]+\/[^`]+)`/g))
        if (
          !customerSections.includes(path.split("/")[0]) ||
          !existsSync(`${root}/${path}`)
        )
          problems.push(`${id}: ${path} is not a readable document`);
      // A document named in prose, such as "the shipping cutoffs manual",
      // counts the same as a path.
      for (const name of unreachable)
        if (criterion.toLowerCase().includes(name))
          problems.push(`${id}: "${name}" is outside ${customerSections}`);
    }
  }
  expect(problems).toEqual([]);
});

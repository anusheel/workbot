import { expect, test } from "vitest";
import { customerSections, knowledgeTools } from "./knowledge-tools";
import { actingAs } from "@/test/auth";

const [findTool, lsTool, catTool, grepTool] = actingAs(
  "viewer",
  knowledgeTools(),
);

test("ls walks sections, documents and headings", async () => {
  expect(await lsTool.run({})).toMatch(/^faq\/  \d+ documents/);
  expect(await lsTool.run({ path: "policies" })).toContain(
    "policies/refunds  Customer refunds",
  );
  expect(await lsTool.run({ path: "policies/refunds" })).toContain(
    "policies/refunds#what-agents-can-approve  What agents can approve",
  );
  await expect(lsTool.run({ path: "legal" })).rejects.toThrow("no section");
});

test("cat reads a document or one of its sections", async () => {
  expect(await catTool.run({ path: "policies/refunds" })).toMatch(
    /^Customer refunds \(Support, updated 2026-06-30\)/,
  );
  const section = await catTool.run({ path: "policies/refunds#timing" });
  expect(section).toContain("## Timing");
  expect(section).not.toContain("What agents can approve");
  await expect(catTool.run({ path: "policies/refunds#nope" })).rejects.toThrow(
    "no section nope",
  );
  await expect(catTool.run({ path: "policies/nope" })).rejects.toThrow(
    "no document",
  );
});

test("grep and find return paths the model can cat", async () => {
  expect(
    await grepTool.run({ pattern: "net 30", path: "policies/" }),
  ).toContain("policies/vendor-onboarding:");
  expect(await grepTool.run({ pattern: "zzzz" })).toBe("No line matches zzzz.");
  expect(await findTool.run({ query: "forklift speed limit" })).toMatch(
    /manuals\/forklift-safety#/,
  );
});

test("grep still matches phrases and escaped symbols", async () => {
  expect(await grepTool.run({ pattern: "net 30" })).toContain("net 30");
  expect(
    await grepTool.run({ pattern: "\\$200", path: "policies/" }),
  ).toContain("policies/refunds:");
});

test("grep rejects patterns that can hang the server, and says why", async () => {
  const started = performance.now();
  await expect(grepTool.run({ pattern: "^(\\w+)*$" })).rejects.toThrow(
    "repeats a group that already repeats",
  );
  expect(performance.now() - started).toBeLessThan(1000);
  await expect(grepTool.run({ pattern: "(a+)+" })).rejects.toThrow("repeats");
  await expect(grepTool.run({ pattern: "((a)+)?b" })).rejects.toThrow(
    "repeats",
  );
  await expect(grepTool.run({ pattern: "a".repeat(101) })).rejects.toThrow(
    "101 characters; the limit is 100",
  );
});

test("grep stops patterns that stall without a nested repeat", async () => {
  for (const pattern of ["(.|.)*q", "(\\s|.)*z", ".*.*.*.*.*.*z"]) {
    const started = performance.now();
    await expect(grepTool.run({ pattern })).rejects.toThrow(
      "took longer than 250 ms",
    );
    expect(performance.now() - started).toBeLessThan(1000);
  }
});

test("grep accepts groups that do not nest a repeat", async () => {
  expect(await grepTool.run({ pattern: "(refund|credit)s? up to" })).toContain(
    "refunds:",
  );
  expect(await grepTool.run({ pattern: "[(+*]+x{2}\\(a+\\)*" })).toBe(
    "No line matches [(+*]+x{2}\\(a+\\)*.",
  );
  expect(await grepTool.run({ pattern: "a".repeat(100) })).toMatch(/^No line/);
});

test("grep searches an invalid expression as plain text", async () => {
  const found = await grepTool.run({ pattern: "(", path: "manuals/" });
  expect(found).toContain("manuals/returns-processing:");
  expect(found).toContain("(resalable as new)");
  expect(await grepTool.run({ pattern: "[a" })).toBe(
    "No line matches [a, which is not a valid regular expression and was searched as plain text.",
  );
});

test("scoped tools see nothing outside their sections", async () => {
  const [find, ls, cat, grep] = knowledgeTools(customerSections);
  expect(await ls.run({})).not.toContain("manuals/");
  await expect(ls.run({ path: "manuals" })).rejects.toThrow("no section");
  await expect(cat.run({ path: "manuals/forklift-safety" })).rejects.toThrow(
    "no document",
  );
  expect(await grep.run({ pattern: "forks low" })).toBe(
    "No line matches forks low.",
  );
  expect(await find.run({ query: "forklift speed limit" })).not.toMatch(
    /manuals\//,
  );
  expect(await find.run({ query: "refund damaged order" })).toMatch(
    /(faq|policies)\//,
  );
});

import { expect, test } from "vitest";
import { customerSections, knowledgeTools } from "./knowledge-tools";

const [findTool, lsTool, catTool, grepTool] = knowledgeTools();

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

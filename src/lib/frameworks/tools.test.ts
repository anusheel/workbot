import { expect, test } from "vitest";
import { type Notebook, researchTools } from "./tools";
import { actingAs } from "@/test/auth";

const toolsOf = (notebook: Notebook) =>
  Object.fromEntries(
    actingAs("viewer", researchTools(notebook)).map((t) => [t.name, t]),
  );

test("without a search key, web_search searches the knowledge base and gives addresses read_url can read", async () => {
  const notebook: Notebook = { findings: [] };
  const { web_search, read_url } = toolsOf(notebook);
  const results = await web_search.run({ query: "refund for a damaged item" });
  const address = results.match(/knowledge:\/\/[a-z0-9/-]+/)?.[0];
  expect(address).toBeDefined();
  const page = await read_url.run({ url: address });
  expect(page).toMatch(/^# /);
  expect(page.length).toBeGreaterThan(100);
});

test("read_url names an address it cannot find", async () => {
  const { read_url } = toolsOf({ findings: [] });
  await expect(read_url.run({ url: "knowledge://faq/nope" })).rejects.toThrow(
    "There is no document at knowledge://faq/nope.",
  );
});

test("save_finding and write_report fill the run's notebook", async () => {
  const notebook: Notebook = { findings: [] };
  const { save_finding, write_report } = toolsOf(notebook);
  expect(
    await save_finding.run({ text: "Refunds take 5 days.", source: "Refunds" }),
  ).toBe("Saved finding 1.");
  await write_report.run({ report: "Refunds take 5 days [1].\n[1] Refunds" });
  expect(notebook).toEqual({
    findings: [{ text: "Refunds take 5 days.", source: "Refunds" }],
    report: "Refunds take 5 days [1].\n[1] Refunds",
  });
});

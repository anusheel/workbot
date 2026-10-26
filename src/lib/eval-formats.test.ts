import { expect, test } from "vitest";
import {
  answered,
  contractCases,
  runs,
  salesExport,
  salesOrders,
  sheetQuestions,
  states,
} from "./eval-formats";
import { docxText } from "./files";
import { readSheet, reconciles } from "./sheets";

test("a paragraph's inline changes become runs, and a Word file reads them back the same", () => {
  const text = "Either party may end it on [-30-][+45+] days' written notice.";
  expect(runs(text)).toEqual([
    "Either party may end it on ",
    { deleted: "30" },
    { inserted: "45" },
    " days' written notice.",
  ]);
});

test("every contract is a Word document whose text keeps its tracked changes", async () => {
  const cases = await contractCases();
  expect(cases).toHaveLength(10);
  const maintenance = cases.find((c) => c.name === "maintenance");
  expect(docxText(maintenance!.bytes)).toContain("on [-30-][+45+] days'");
});

test("the orders are the same for the same seed, and the export reads back with its totals reconciled", async () => {
  const orders = salesOrders(300);
  expect(salesOrders(300)).toEqual(orders);
  const table = await readSheet(await salesExport(orders));
  expect(table.rows).toHaveLength(300);
  expect(table.columns.map((c) => c.type)).toEqual([
    "VARCHAR",
    "DATE",
    "VARCHAR",
    "VARCHAR",
    "VARCHAR",
    "VARCHAR",
    "DOUBLE",
    "DOUBLE",
    "DOUBLE",
    "DOUBLE",
  ]);
  expect(table.totals.map((t) => t.column)).toEqual(["units", "total"]);
  expect(table.totals.every(reconciles)).toBe(true);
  for (const { truth } of sheetQuestions)
    expect(truth(orders).figure).toBeGreaterThan(0);
});

test("an answer states a figure to the precision it was written in", () => {
  expect(states("Revenue was $1,238,410.17.", 1_238_410.17)).toBe(true);
  expect(states("About $1.24 million.", 1_238_410.17)).toBe(true);
  expect(states("About $1.2M.", 1_238_410.17)).toBe(true);
  expect(states("About $1.3 million.", 1_238_410.17)).toBe(false);
  expect(states("2,784 orders.", 2784)).toBe(true);
  expect(states("2,785 orders.", 2784)).toBe(false);
  expect(states("$232,633 more.", 232_632.99)).toBe(true);
  expect(
    answered("South Bay led with $2.2 million.", {
      text: "South Bay",
      figure: 2_199_846.35,
    }),
  ).toBe(true);
  expect(
    answered("East Bay led with $2.2 million.", {
      text: "South Bay",
      figure: 2_199_846.35,
    }),
  ).toBe(false);
});

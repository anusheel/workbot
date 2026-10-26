import ExcelJS from "exceljs";
import { expect, test } from "vitest";
import { scripted } from "@/test/model";
import {
  type Table,
  ask,
  getSheet,
  listSheets,
  readSheet,
  reconciles,
  saveSheet,
  tableOf,
  withSandbox,
} from "./sheets";
import { withTrace } from "./tracing";

/** An export as people make them: a merged title, a blank row, the header, a region merged down three rows, formulas, and a totals row. */
async function exportBook(statedTotal = 109.5) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Orders");
  sheet.addRow(["Order export, March 2026"]);
  sheet.mergeCells("A1:F1");
  sheet.addRow([]);
  sheet.addRow([
    "Order date",
    "Region",
    "Units",
    "Unit price",
    "Total",
    "Paid",
  ]);
  const orders: [Date, string | null, number, number, boolean][] = [
    [new Date(Date.UTC(2026, 2, 2)), "West", 2, 10, true],
    [new Date(Date.UTC(2026, 2, 3)), null, 1, 7.5, false],
    [new Date(Date.UTC(2026, 2, 3)), null, 4, 20, true],
    [new Date(Date.UTC(2026, 2, 9)), "East", 1, 12, true],
  ];
  orders.forEach(([date, region, units, price, paid], i) => {
    const r = i + 4;
    sheet.addRow([
      date,
      region,
      units,
      price,
      { formula: `C${r}*D${r}`, result: units * price },
      paid,
    ]);
  });
  sheet.mergeCells("B4:B6");
  sheet.getColumn(1).numFmt = "yyyy-mm-dd";
  sheet.addRow([
    "Total",
    null,
    { formula: "SUM(C4:C7)", result: 8 },
    null,
    { formula: "SUM(E4:E7)", result: statedTotal },
  ]);
  return new Uint8Array(await book.xlsx.writeBuffer());
}

test("a sheet reads past its title, takes merged cells from their master and formulas by their results", async () => {
  const table = await readSheet(await exportBook());
  expect(table.columns).toEqual([
    { name: "order_date", header: "Order date", type: "DATE" },
    { name: "region", header: "Region", type: "VARCHAR" },
    { name: "units", header: "Units", type: "DOUBLE" },
    { name: "unit_price", header: "Unit price", type: "DOUBLE" },
    { name: "total", header: "Total", type: "DOUBLE" },
    { name: "paid", header: "Paid", type: "BOOLEAN" },
  ]);
  expect(table.rows).toHaveLength(4);
  expect(table.rows.map((row) => row[1])).toEqual([
    "West",
    "West",
    "West",
    "East",
  ]);
  expect(table.rows.map((row) => row[4])).toEqual([20, 7.5, 80, 12]);
});

test("the totals row leaves the data and is checked against it", async () => {
  const good = await readSheet(await exportBook());
  expect(good.totals).toEqual([
    { column: "units", stated: 8, summed: 8 },
    { column: "total", stated: 109.5, summed: 119.5 },
  ]);
  expect(good.totals.map(reconciles)).toEqual([true, false]);
  const fixed = await readSheet(await exportBook(119.5));
  expect(fixed.totals.every(reconciles)).toBe(true);
});

test("a sheet without a row of column names is refused", async () => {
  const book = new ExcelJS.Workbook();
  book.addWorksheet("Notes").addRow([1, 2, 3]);
  await expect(
    readSheet(new Uint8Array(await book.xlsx.writeBuffer())),
  ).rejects.toThrow("No header row");
});

const sandboxed = async (fn: Parameters<typeof withSandbox>[1]) =>
  withSandbox(await readSheet(await exportBook()), fn);

test("a SELECT runs on the sheet and stops at its row limit", async () => {
  await sandboxed(async (sandbox) => {
    expect(
      await sandbox.query(
        "select region, sum(total) as revenue from sheet group by region order by revenue desc",
      ),
    ).toEqual({
      columns: ["region", "revenue"],
      rows: [
        ["West", 107.5],
        ["East", 12],
      ],
      more: false,
    });
    expect(
      await sandbox.query("select order_date from sheet order by 1", {
        limit: 2,
      }),
    ).toEqual({
      columns: ["order_date"],
      rows: [["2026-03-02"], ["2026-03-03"]],
      more: true,
    });
  });
});

test("anything but one SELECT is refused, and the sandbox reaches no file and no setting", async () => {
  await sandboxed(async (sandbox) => {
    await expect(sandbox.query("delete from sheet")).rejects.toThrow(
      "Only a SELECT runs here.",
    );
    await expect(sandbox.query("select 1; drop table sheet")).rejects.toThrow(
      "one statement at a time; this was 2",
    );
    await expect(
      sandbox.query("select * from read_csv('/etc/passwd')"),
    ).rejects.toThrow("Permission Error");
    await expect(
      sandbox.query("select * from sheet, read_text('package.json')"),
    ).rejects.toThrow("Permission Error");
    expect(
      (await sandbox.query("select count(*) as n from sheet")).rows,
    ).toEqual([["4"]]);
  });
});

test("a query that runs too long is stopped", async () => {
  await sandboxed(async (sandbox) => {
    await expect(
      sandbox.query("select count(*) from range(100000000000)", {
        seconds: 0.2,
      }),
    ).rejects.toThrow("ran past 0.2 s");
    expect((await sandbox.query("select 1 as one")).rows).toEqual([[1]]);
  });
});

test("an answer comes back with every query the model ran, the refused ones included", async () => {
  const table: Table = await readSheet(await exportBook());
  const { model, prompts } = scripted([
    {
      calls: [{ name: "query", input: { sql: "update sheet set units = 0" } }],
    },
    {
      calls: [
        {
          name: "query",
          input: { sql: "select sum(total) as revenue from sheet" },
        },
      ],
    },
    { text: "Revenue was $119.50." },
  ]);
  const { answer, queries, stopped } = await withTrace(
    { caller: "test", name: "sheets", role: "viewer" },
    () => ask(table, "What was revenue?", model),
  );
  expect(answer).toBe("Revenue was $119.50.");
  expect(stopped).toBe("answered");
  expect(queries).toEqual([
    { sql: "update sheet set units = 0", error: "Only a SELECT runs here." },
    {
      sql: "select sum(total) as revenue from sheet",
      columns: ["revenue"],
      rows: [[119.5]],
      more: false,
    },
  ]);
  expect(JSON.stringify(prompts[0])).toContain(
    '- order_date DATE (\\"Order date\\")',
  );
});

test("a sheet is kept with what reading it found, and read again for a question", async () => {
  const bytes = await exportBook();
  const saved = await saveSheet("orders-march.xlsx", bytes);
  expect(saved).toMatchObject({ name: "orders-march.xlsx", rows: 4 });
  expect(saved.columns).toHaveLength(6);
  expect((await getSheet(saved.id))?.totals).toHaveLength(2);
  expect((await listSheets()).map((s) => s.id)).toContain(saved.id);
  expect((await tableOf(saved.id))?.rows).toHaveLength(4);
  await expect(
    saveSheet("notes.xlsx", new Uint8Array([1, 2])),
  ).rejects.toThrow();
});

test("a column named by a reserved word is shown to the model quoted, as SQL needs it", async () => {
  const { model, prompts } = scripted([{ text: "One order." }]);
  const table: Table = {
    columns: [
      { name: "order", header: "Order", type: "VARCHAR" },
      { name: "units", header: "Units", type: "DOUBLE" },
    ],
    rows: [["SO-1", 3]],
    totals: [],
  };
  await withTrace({ caller: "test", name: "sheets", role: "viewer" }, () =>
    ask(table, "How many orders?", model),
  );
  const system = JSON.stringify(prompts[0]);
  expect(system).toContain('- \\"order\\" VARCHAR');
  expect(system).toContain("- units DOUBLE");
});

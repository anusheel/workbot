import { expect, test } from "vitest";
import { failingTests, metrics, report } from "./analysis";

test("every metric is a titled query, and every data test passes on the dataset", async () => {
  const defined = await metrics();
  expect(defined.map((m) => m.name)).toEqual([
    "cost_per_person",
    "new_people",
    "retention",
    "usage_by_kind",
    "weekly_active_people",
  ]);
  expect(defined.every((m) => m.title && /^select|^with/i.test(m.sql))).toBe(
    true,
  );
  expect(await failingTests()).toEqual([]);
});

test("the report has every metric's rows", async () => {
  const tables = await report();
  expect(tables.every((t) => t.result.rows.length > 0)).toBe(true);
});

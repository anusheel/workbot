import { expect, test } from "vitest";
import { catalog } from "./catalog";

test("the catalog has the components a dashboard, a form and a timeline need, and the prompt names them", () => {
  const names = Object.keys(catalog.data.components);
  expect(names.length).toBeGreaterThanOrEqual(15);
  const prompt = catalog.prompt();
  for (const name of [
    "Metric",
    "Table",
    "BarChart",
    "Timeline",
    "Tabs",
    "Form",
    "Button",
  ])
    expect(prompt).toContain(name);
  expect(prompt).toContain("submit_request");
});

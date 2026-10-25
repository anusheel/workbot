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

const submitParams = catalog.data.actions.submit_request.params;
const valid = {
  title: "Replace the label printer",
  body: null,
  team: "finance",
  priority: "high",
};

test("submit_request accepts a team and a priority from the request model", () => {
  expect(submitParams.safeParse(valid).success).toBe(true);
});

test("submit_request rejects a team the request model does not list and names the field", () => {
  const result = submitParams.safeParse({ ...valid, team: "Marketing" });
  expect(result.success).toBe(false);
  expect(result.error?.issues[0].path).toEqual(["team"]);
});

test("submit_request rejects an unknown priority", () => {
  expect(submitParams.safeParse({ ...valid, priority: "urgent" }).success).toBe(
    false,
  );
});

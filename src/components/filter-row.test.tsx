import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { statusLabels, statuses } from "@/lib/request-model";
import { FilterRow } from "./filter-row";

test("marks the chosen link as current, and keeps the other filter in every href", () => {
  const html = renderToStaticMarkup(
    <FilterRow
      name="status"
      label="Status"
      all="All statuses"
      options={statuses}
      filter={{ team: "finance", status: "done" }}
      labels={statusLabels}
    />,
  );
  expect(html).toContain('aria-label="Status"');
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toMatch(/aria-current="page"[^>]*>Done</);
  expect(html).toContain('href="/requests?team=finance&amp;status=open"');
});

import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  statusLabels,
  statuses,
  teams,
  type WorkRequest,
} from "@/lib/requests";
import { FilterRow } from "./filter-row";
import { RequestList } from "./request-list";

const request: WorkRequest = {
  id: "1",
  title: "Replace the badge printer",
  body: "",
  team: "operations",
  priority: "high",
  status: "in_progress",
  createdAt: new Date(),
};

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

test("labels the team row, and marks All current when no team is chosen", () => {
  const html = renderToStaticMarkup(
    <FilterRow
      name="team"
      label="Team"
      all="All teams"
      options={teams}
      filter={{ status: "done" }}
    />,
  );
  expect(html).toContain('aria-label="Team"');
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toMatch(/aria-current="page"[^>]*>All teams</);
});

// The brief keeps this change to filter-row.test.tsx, so the list's new
// states are covered here rather than in request-list.test.tsx.
test("the list counts its rows only when asked to", () => {
  const two = [request, { ...request, id: "2" }];
  expect(
    renderToStaticMarkup(<RequestList requests={two} showCount />),
  ).toContain(">2 requests<");
  expect(
    renderToStaticMarkup(<RequestList requests={[request]} showCount />),
  ).toContain(">1 request<");
  expect(renderToStaticMarkup(<RequestList requests={two} />)).not.toMatch(
    /\d+ requests?</,
  );
});

test("an empty filtered list says so and links to clear the filters", () => {
  const html = renderToStaticMarkup(<RequestList requests={[]} filtered />);
  expect(html).toContain("No requests match these filters");
  expect(html).toContain('href="/requests"');
  expect(html).toContain("Clear filters");
  expect(html).not.toContain("No requests yet");
});

test("an empty unfiltered list still says there are no requests yet", () => {
  const html = renderToStaticMarkup(<RequestList requests={[]} showCount />);
  expect(html).toContain("No requests yet.");
  expect(html).not.toContain("match these filters");
  expect(html).not.toMatch(/\d+ requests?</);
});

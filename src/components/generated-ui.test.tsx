import type { Spec } from "@json-render/react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { GeneratedUI } from "./generated-ui";

const spec: Spec = {
  root: "page",
  state: { tab: "teams" },
  elements: {
    page: {
      type: "Page",
      props: { title: "Operations", description: "Open work this week" },
      children: ["grid", "tabs", "teams", "priority", "timeline"],
    },
    grid: { type: "Grid", props: { columns: 2 }, children: ["open", "table"] },
    open: {
      type: "Metric",
      props: { label: "Open requests", value: 12, note: "3 high priority" },
    },
    table: {
      type: "Table",
      props: {
        columns: [
          { key: "title", label: "Request" },
          { key: "team", label: "Team" },
        ],
        rows: [{ title: "Badge printer", team: "operations" }],
      },
    },
    tabs: {
      type: "Tabs",
      props: {
        tabs: [
          { id: "teams", label: "By team" },
          { id: "priority", label: "By priority" },
        ],
        value: { $bindState: "/tab" },
      },
    },
    teams: {
      type: "BarChart",
      props: {
        title: "By team",
        data: [
          { label: "finance", value: 5 },
          { label: "support", value: 7 },
        ],
      },
      visible: { $state: "/tab", eq: "teams" },
    },
    priority: {
      type: "PieChart",
      props: { title: "By priority", data: [{ label: "high", value: 3 }] },
      visible: { $state: "/tab", eq: "priority" },
    },
    timeline: {
      type: "Timeline",
      props: {
        events: [{ when: "Mon", title: "Printer out of labels", detail: null }],
      },
    },
  },
};

test("renders a generated page: metrics, a table, charts behind tabs, and a timeline", () => {
  const html = renderToStaticMarkup(<GeneratedUI spec={spec} />);
  expect(html).toContain("Operations");
  expect(html).toContain("Open requests");
  expect(html).toContain(">12<");
  expect(html).toContain("Badge printer");
  expect(html).toContain('aria-selected="true"');
  expect(html).toContain("By team");
  expect(html).toContain("support");
  expect(html).not.toContain("By priority</figcaption>");
  expect(html).toContain("Printer out of labels");
});

test("renders nothing for an empty spec", () => {
  expect(renderToStaticMarkup(<GeneratedUI spec={null} />)).toBe("");
});

test("a list bound to state that has not streamed in yet renders empty, not broken", () => {
  const html = renderToStaticMarkup(
    <GeneratedUI
      spec={{
        root: "table",
        elements: {
          table: {
            type: "Table",
            props: {
              columns: [{ key: "title", label: "Request" }],
              rows: { $state: "/latest" },
            },
          },
        },
      }}
    />,
  );
  expect(html).toContain("Request");
  expect(html).not.toContain('<tr class="border-t');
});

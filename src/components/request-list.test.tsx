import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { RequestList } from "./request-list";

test("shows an empty state, then one row per request", () => {
  expect(renderToStaticMarkup(<RequestList requests={[]} />)).toContain(
    "No requests yet",
  );
  const html = renderToStaticMarkup(
    <RequestList
      requests={[
        {
          id: "1",
          title: "Replace the badge printer",
          body: "",
          team: "operations",
          priority: "high",
          status: "in_progress",
          createdAt: new Date(),
        },
      ]}
    />,
  );
  expect(html).toContain("Replace the badge printer");
  expect(html).toContain("operations");
  expect(html).toContain(">high<");
  expect(html).toContain(">in progress<");
});

import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StatusActions } from "./status-actions";

test("gives each next status its own form inside a labelled group", () => {
  const html = renderToStaticMarkup(
    <StatusActions id="r1" status="open" action={async () => {}} />,
  );
  expect(html).toContain('role="group"');
  expect(html).toContain('aria-label="Change status"');
  expect(html.match(/<form/g)).toHaveLength(2);
  expect(html).toContain("Mark in progress");
  expect(html).toContain("Mark done");
  expect(html).not.toContain("Mark open");
});

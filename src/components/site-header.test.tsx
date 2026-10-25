import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { SiteHeader } from "./site-header";

test("renders the product name and a link to each page", () => {
  const html = renderToStaticMarkup(<SiteHeader />);
  expect(html).toContain('href="/"');
  expect(html).toContain("WorkBot");
  expect(html).toContain('href="/chat"');
  expect(html).toContain('href="/requests"');
  expect(html).toContain('href="/policies"');
  expect(html).toContain('href="/dashboards"');
  expect(html).toContain('href="/admin"');
});

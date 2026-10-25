import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StatusCounts } from "./status-counts";

test("links each status to the filtered list and shows its count", () => {
  const html = renderToStaticMarkup(
    <StatusCounts byStatus={{ open: 4, in_progress: 2, done: 7 }} />,
  );
  expect(html.match(/<a /g)).toHaveLength(3);
  expect(html).toMatch(/href="\/requests\?status=open"[^]*?>4</);
  expect(html).toMatch(/href="\/requests\?status=in_progress"[^]*?>2</);
  expect(html).toMatch(/href="\/requests\?status=done"[^]*?>7</);
});

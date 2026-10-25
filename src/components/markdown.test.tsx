import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Markdown } from "./markdown";

test("renders markdown with highlighted, copyable code blocks", () => {
  const html = renderToStaticMarkup(
    <Markdown>
      {"Refunds are **final** after 30 days.\n\n```ts\nconst limit = 200;\n```"}
    </Markdown>,
  );
  expect(html).toContain("<strong>final</strong>");
  expect(html).toContain('<span class="hljs-keyword">const</span>');
  expect(html).toContain(">Copy</button>");
});

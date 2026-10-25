import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { CodeBlock } from "./code-block";

test("wraps the block with a copy button and keeps the pre attributes", () => {
  const html = renderToStaticMarkup(
    <CodeBlock className="hljs">
      <code>const x = 1;</code>
    </CodeBlock>,
  );
  expect(html).toContain('<pre class="hljs"><code>const x = 1;</code></pre>');
  expect(html).toContain(">Copy</button>");
});

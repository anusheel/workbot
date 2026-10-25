import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Sparkline } from "./sparkline";

test("draws one point per value on a fixed 0 to 1 scale, and nothing for a single value", () => {
  const html = renderToStaticMarkup(
    <Sparkline
      values={[0, 1, 0.5]}
      label="chat scores"
      width={100}
      height={24}
    />,
  );
  expect(html).toContain('aria-label="chat scores"');
  expect(html).toContain('points="0.0,22.0 50.0,2.0 100.0,12.0"');
  expect(renderToStaticMarkup(<Sparkline values={[1]} label="one" />)).toBe("");
});

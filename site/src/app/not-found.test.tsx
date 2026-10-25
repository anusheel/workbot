import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("site not-found page", () => {
  it("shows a heading and a link back to the home page", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("<h1");
    expect(html).toContain('href="/"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-sans" }),
}));

import { site } from "../site";
import RootLayout, { metadata } from "./layout";

describe("site layout", () => {
  it("sets a title template, Open Graph, and the site's address and author", () => {
    expect(metadata.title).toEqual({
      default: "WorkBot",
      template: "%s · WorkBot",
    });
    expect(metadata.openGraph).toMatchObject({ title: "WorkBot" });
    expect(String(metadata.metadataBase)).toBe(new URL(site.url).href);
    expect(metadata.authors).toEqual([{ name: site.author }]);
  });

  it("links both README pages from the footer", () => {
    const html = renderToStaticMarkup(
      <RootLayout params={Promise.resolve({})}>
        <main>page</main>
      </RootLayout>,
    );
    expect(html).toContain("<footer");
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/joinplank\.com\/ai-fde-course"[^>]*>[^<]{5,}<\/a>/,
    );
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/joinplank\.com\/fde\/anusheel"[^>]*>[^<]{5,}<\/a>/,
    );
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-sans" }),
}));

import RootLayout, { metadata } from "./layout";

describe("site layout", () => {
  it("sets a title template and Open Graph without a metadataBase", () => {
    expect(metadata.title).toEqual({
      default: "WorkBot",
      template: "%s · WorkBot",
    });
    expect(metadata.openGraph).toMatchObject({ title: "WorkBot" });
    expect(metadata.metadataBase).toBeUndefined();
    expect(metadata.openGraph?.url).toBeUndefined();
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

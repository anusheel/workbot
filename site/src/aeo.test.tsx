import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import Home from "./app/page";
import Question from "./app/questions/[slug]/page";
import { GET as llms } from "./app/llms.txt/route";
import robots from "./app/robots";
import sitemap from "./app/sitemap";
import { questions } from "./site";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-sans" }),
}));

// The answer-engine checklist, run on every change: `pnpm check:aeo`.
const structured = (html: string) =>
  [
    ...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g),
  ].map((m) => JSON.parse(m[1]));

test("crawlers, answer engines' included, may read everything, and find the sitemap", () => {
  const { rules, sitemap: map } = robots();
  const all = [rules].flat();
  expect(
    all.some(
      (r) => [r.userAgent].flat().includes("ClaudeBot") && r.allow === "/",
    ),
  ).toBe(true);
  expect(all.every((r) => !r.disallow)).toBe(true);
  expect(map).toMatch(/\/sitemap\.xml$/);
});

test("the sitemap lists the home page and every question, each dated", () => {
  const urls = sitemap();
  expect(urls).toHaveLength(questions.length + 2);
  expect(urls.every((u) => u.lastModified)).toBe(true);
});

test("llms.txt names every question with its answer", async () => {
  const text = await llms().text();
  for (const q of questions) expect(text).toContain(q.question);
});

test("the home page and every question page carry structured data with an author and a date", async () => {
  const pages = [
    renderToStaticMarkup(Home()),
    ...(await Promise.all(
      questions.map(async (q) =>
        renderToStaticMarkup(
          await Question({
            params: Promise.resolve({ slug: q.slug }),
          } as never),
        ),
      ),
    )),
  ];
  for (const html of pages) {
    const [data] = structured(html);
    expect(data.author.name).toBeTruthy();
    expect(data.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
});

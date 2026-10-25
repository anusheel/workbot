import { MockLanguageModelV4 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { nextLink, scrape } from "./scrape";

afterEach(() => vi.unstubAllGlobals());

const Job = z.object({ title: z.string(), company: z.string() });

const model = (pages: Record<string, unknown[]>) =>
  new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      const text = String(
        (prompt.at(-1)?.content as { text: string }[])[0].text,
      );
      const page = text.split("\n")[0].replace("Page: ", "");
      return {
        content: [
          { type: "text", text: JSON.stringify({ items: pages[page] }) },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });

test("nextLink reads rel=next and the usual link texts, resolved against the page", () => {
  expect(
    nextLink(
      '<a href="/jobs?page=2" rel="next">2</a>',
      "https://x.example/jobs",
    ),
  ).toBe("https://x.example/jobs?page=2");
  expect(
    nextLink(
      '<a href="?p=2" class="morelink">More</a>',
      "https://x.example/news",
    ),
  ).toBe("https://x.example/news?p=2");
  expect(nextLink('<a href="/b">Next page</a>', "https://x.example/a")).toBe(
    "https://x.example/b",
  );
  expect(
    nextLink('<a href="/about">About</a>', "https://x.example/"),
  ).toBeUndefined();
});

test("scrape follows next links for the pages asked and validates every item", async () => {
  const site: Record<string, string> = {
    "https://x.example/jobs":
      '<ul><li>Picker at Fieldstone</li></ul><a href="/jobs?page=2" rel="next">Next</a>',
    "https://x.example/jobs?page=2": "<ul><li>Driver at Northwind</li></ul>",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (input: string | URL) =>
        new Response(site[String(input)] ?? "", {
          status: site[String(input)] ? 200 : 404,
        }),
    ),
  );
  const items = await scrape(
    "https://x.example/jobs",
    Job,
    model({
      "https://x.example/jobs": [{ title: "Picker", company: "Fieldstone" }],
      "https://x.example/jobs?page=2": [
        { title: "Driver", company: "Northwind" },
      ],
    }),
    { pages: 3 },
  );
  expect(items).toEqual([
    { title: "Picker", company: "Fieldstone" },
    { title: "Driver", company: "Northwind" },
  ]);
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
});

test("a page that is not there is an error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 404 })),
  );
  await expect(
    scrape("https://x.example/gone", Job, model({})),
  ).rejects.toThrow("answered 404");
});

const stubSite = (site: Record<string, string>) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async (input: string | URL) =>
        new Response(site[String(input)] ?? "", {
          status: site[String(input)] ? 200 : 404,
        }),
    ),
  );

test("scrape stops when a next link points back to a page already read", async () => {
  stubSite({
    "https://x.example/jobs":
      '<ul><li>Picker</li></ul><a href="/jobs?page=2" rel="next">Next</a>',
    "https://x.example/jobs?page=2":
      '<ul><li>Driver</li></ul><a href="/jobs#top">Next</a>',
  });
  const items = await scrape(
    "https://x.example/jobs",
    Job,
    model({
      "https://x.example/jobs": [{ title: "Picker", company: "Fieldstone" }],
      "https://x.example/jobs?page=2": [
        { title: "Driver", company: "Northwind" },
      ],
    }),
    { pages: 5 },
  );
  expect(items).toHaveLength(2);
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
});

test("scrape keeps what it read when the next link is not http", async () => {
  stubSite({
    "https://x.example/jobs":
      '<ul><li>Picker</li></ul><a href="javascript:void(0)">Next</a>',
  });
  const items = await scrape(
    "https://x.example/jobs",
    Job,
    model({
      "https://x.example/jobs": [{ title: "Picker", company: "Fieldstone" }],
    }),
    { pages: 3 },
  );
  expect(items).toHaveLength(1);
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
});

test("nextLink prefers rel=next and ignores 'More about us'", () => {
  expect(
    nextLink(
      '<a href="/about">More about us</a><a href="/p2" rel="next">2</a>',
      "https://x.example/p1",
    ),
  ).toBe("https://x.example/p2");
  expect(
    nextLink('<a href="/about">More about us</a>', "https://x.example/p1"),
  ).toBeUndefined();
  expect(
    nextLink(
      '<a href="/n">Next</a><a href="/p2" rel="next">2</a>',
      "https://x.example/p1",
    ),
  ).toBe("https://x.example/p2");
  expect(nextLink('<a href="/m">More</a>', "https://x.example/")).toBe(
    "https://x.example/m",
  );
});

import { afterEach, expect, test, vi } from "vitest";
import { readPage, searchWeb, textOf } from "./web";

afterEach(() => vi.unstubAllGlobals());

test("textOf keeps the words and the line structure, and drops the rest", () => {
  const html = `<html><head><style>p{color:red}</style><script>alert(1)</script></head>
    <body><h1>Refunds &amp; returns</h1><p>Within <b>30</b> days.</p><ul><li>Photo first</li><li>Then &#36;0 fee</li></ul></body></html>`;
  expect(textOf(html)).toBe(
    "Refunds & returns\nWithin 30 days.\nPhoto first\nThen $0 fee",
  );
});

test("readPage fetches, extracts and caps the text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<p>" + "word ".repeat(100) + "</p>")),
  );
  const text = await readPage("https://example.com/page", 20);
  expect(text).toBe("word word word word ");
  expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe(
    "https://example.com/page",
  );
});

test("readPage refuses private addresses, other schemes, and redirects into them", async () => {
  for (const url of [
    "http://localhost/admin",
    "http://127.0.0.1:5432/",
    "http://10.0.0.8/",
    "http://172.20.1.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.100.100.200/latest/meta-data/",
    "http://100.127.255.255/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://db.internal/",
  ]) {
    await expect(readPage(url)).rejects.toThrow("not a public web address");
  }
  await expect(readPage("file:///etc/passwd")).rejects.toThrow(
    "not a public web address",
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response("", {
          status: 302,
          headers: { location: "http://169.254.169.254/" },
        }),
    ),
  );
  await expect(readPage("https://example.com/go")).rejects.toThrow(
    "not a public web address",
  );
});

test("readPage follows public redirects and gives up after 3 hops", async () => {
  const redirect = (to: string) =>
    new Response("", { status: 301, headers: { location: to } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => redirect("/again")),
  );
  await expect(readPage("https://example.com/loop")).rejects.toThrow(
    "redirects too many times",
  );

  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(redirect("/moved"))
      .mockResolvedValueOnce(new Response("<p>Found it</p>")),
  );
  expect(await readPage("https://example.com/old")).toBe("Found it");
  expect(String(vi.mocked(fetch).mock.calls[1][0])).toBe(
    "https://example.com/moved",
  );
});

test("readPage stops reading a body past the byte cap", async () => {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new TextEncoder().encode("x".repeat(100_000)));
    },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body)),
  );
  expect((await readPage("https://example.com/huge", 10)).length).toBe(10);
  expect(pulled).toBeLessThan(10);
});

test("readPage reports a page that is not there", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 404 })),
  );
  await expect(readPage("https://example.com/missing")).rejects.toThrow(
    "answered 404",
  );
});

test("searchWeb asks Brave and returns title, url and description", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        web: {
          results: [
            {
              title: "T",
              url: "https://t.example",
              description: "D",
              extra: 1,
            },
          ],
        },
      }),
    ),
  );
  expect(await searchWeb("vendor onboarding", 3)).toEqual([
    { title: "T", url: "https://t.example", description: "D" },
  ]);
  const request = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
  expect(request.searchParams.get("q")).toBe("vendor onboarding");
  expect(request.searchParams.get("count")).toBe("3");
});

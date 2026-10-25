import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { type Action, type Browser, bounds, browse } from "./browser-agent";

/** A browser that records what is done to it and shows a result after the lookup is clicked. */
function fakeBrowser() {
  const log: string[] = [];
  let typed = "";
  const browser: Browser = {
    goto: async (url) => void log.push(`goto ${url}`),
    screenshot: async () => new Uint8Array([137, 80, 78, 71]),
    click: async (x, y) => void log.push(`click ${x},${y}`),
    type: async (text) => void log.push(`type ${(typed = text)}`),
    press: async (key) => void log.push(`press ${key}`),
    scroll: async (dy) => void log.push(`scroll ${dy}`),
    wait: async () => void log.push("wait"),
    url: () => "file:///portal.html",
    close: async () => {},
  };
  return { browser, log, typed: () => typed };
}

const scripted = (actions: Action[]) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(actions.shift()) }],
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
    }),
  });

test("the agent acts on the page one step at a time until it is done", async () => {
  const { browser, log } = fakeBrowser();
  const model = scripted([
    { kind: "click", x: 200, y: 140, why: "focus the invoice field" },
    { kind: "type", text: "INV-4411", why: "enter the number" },
    { kind: "click", x: 330, y: 140, why: "press Look up" },
    {
      kind: "done",
      result: "Paid on 2026-09-10 by ACH.",
      why: "the result is on screen",
    },
  ]);
  const steps: string[] = [];
  const result = await browse(
    "Find the status of invoice INV-4411",
    "file:///portal.html",
    model,
    browser,
    {
      on: { step: (n, a) => steps.push(`${n}:${a.kind}`) },
    },
  );
  expect(result).toEqual({
    outcome: "done",
    result: "Paid on 2026-09-10 by ACH.",
    steps: 4,
    usage: { input: 40, output: 80 },
  });
  expect(log).toEqual([
    "goto file:///portal.html",
    "click 200,140",
    "type INV-4411",
    "click 330,140",
  ]);
  expect(steps).toEqual(["1:click", "2:type", "3:click", "4:done"]);
});

test("the agent gives up when it says so, and stops at the step limit otherwise", async () => {
  const { browser } = fakeBrowser();
  expect(
    await browse(
      "?",
      "file:///x",
      scripted([
        {
          kind: "give_up",
          reason: "The page never loads.",
          why: "blank after 2 tries",
        },
      ]),
      browser,
    ),
  ).toMatchObject({ outcome: "gave_up", result: "The page never loads." });
  const forever = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({ kind: "scroll", dy: 300, why: "looking" }),
        },
      ],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 1,
          noCache: 1,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
  expect(
    await browse("?", "file:///x", forever, browser, { maxSteps: 3 }),
  ).toMatchObject({ outcome: "steps", steps: 3 });
});

test("a browser's bounds are the site it started on and the public web", () => {
  const portal = bounds("https://portal.example.com/login");
  expect(portal("https://portal.example.com/invoices?page=2")).toBe(true);
  expect(portal("https://news.ycombinator.com/")).toBe(true);
  for (const url of [
    "http://localhost:3000/",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.1.1/",
    "file:///etc/passwd",
  ]) {
    expect(portal(url)).toBe(false);
  }
  const intranet = bounds("http://192.168.1.10/portal/");
  expect(intranet("http://192.168.1.10/portal/invoices")).toBe(true);
  expect(intranet("http://192.168.1.11/")).toBe(false);
  const local = bounds("file:///home/me/fixtures/portal.html");
  expect(local("file:///home/me/fixtures/invoice.html")).toBe(true);
  expect(local("file:///etc/passwd")).toBe(false);
  expect(local("https://example.com/")).toBe(true);
});

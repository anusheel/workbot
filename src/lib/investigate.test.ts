import { MockLanguageModelV4 } from "ai/test";
import { afterEach, expect, test, vi } from "vitest";
import type { Browser } from "./browser-agent";
import { type Entry, investigate } from "./investigate";
import { costOf } from "./providers";

type Reply = { text?: string; calls?: { name: string; input: unknown }[] };

/** A model that answers from a script, priced as the small model. */
const scripted = (replies: Reply[]) =>
  new MockLanguageModelV4({
    modelId: "claude-haiku-5-5",
    doGenerate: async () => {
      const reply = replies.shift() ?? {};
      return {
        content: [
          ...(reply.text ? [{ type: "text" as const, text: reply.text }] : []),
          ...(reply.calls ?? []).map((call, i) => ({
            type: "tool-call" as const,
            toolCallId: `${replies.length}-${i}`,
            toolName: call.name,
            input: JSON.stringify(call.input),
          })),
        ],
        finishReason: {
          unified: reply.calls?.length
            ? ("tool-calls" as const)
            : ("stop" as const),
          raw: undefined,
        },
        usage: {
          inputTokens: {
            total: 100,
            noCache: 100,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 50, text: 50, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });

const fakeBrowser = (actions: string[]): Browser => ({
  goto: async (url) => void actions.push(`goto ${url}`),
  screenshot: async () => new Uint8Array([137, 80, 78, 71]),
  click: async () => void actions.push("click"),
  type: async (text) => void actions.push(`type ${text}`),
  press: async () => {},
  scroll: async () => {},
  wait: async () => {},
  url: () => "https://portal.example.com/",
  close: async () => void actions.push("close"),
});

const line = (e: Entry) => (e.kind === "tool" ? e.name : e.kind);
const toolResult = (log: Entry[], name: string) => {
  const entry = log.find((e) => e.kind === "tool" && e.name === name);
  return entry?.kind === "tool" ? entry.result : undefined;
};

afterEach(() => vi.unstubAllGlobals());

test("the agent searches the knowledge base, saves what it finds, and reports with sources, logged and priced", async () => {
  const model = scripted([
    {
      text: "I will look up the refund limit.",
      calls: [{ name: "find", input: { query: "refund limit support agent" } }],
    },
    {
      calls: [
        {
          name: "save_finding",
          input: {
            text: "A support agent may refund up to $200 per order.",
            source: "Customer refunds",
          },
        },
      ],
    },
    {
      calls: [
        {
          name: "write_report",
          input: {
            report:
              "A support agent may refund up to $200 per order [Customer refunds].\n\n[1] Customer refunds",
          },
        },
      ],
    },
  ]);
  const seen: Entry[] = [];
  const run = await investigate(
    "Can a support agent refund $250 alone?",
    model,
    {
      on: { log: (entry) => seen.push(entry) },
    },
  );
  expect(run.findings).toEqual([
    {
      text: "A support agent may refund up to $200 per order.",
      source: "Customer refunds",
    },
  ]);
  expect(run.report).toContain("[Customer refunds]");
  expect(run.stopped).toBe("answered");
  expect(run.log.map(line)).toEqual([
    "thought",
    "find",
    "save_finding",
    "write_report",
    "done",
  ]);
  expect(seen).toEqual(run.log);
  expect(run.log.every((e) => e.at instanceof Date)).toBe(true);
  expect(run.dollars).toBeCloseTo(
    3 * costOf("claude-haiku-5-5", { input: 100, output: 50 }),
    12,
  );
});

test("browse_site falls back to the page's text when the browser agent gives up", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response("<p>Returns are accepted within 30 days.</p>"),
    ),
  );
  const model = scripted([
    {
      calls: [
        {
          name: "browse_site",
          input: {
            url: "https://shop.example.com/returns",
            task: "Find the return window.",
          },
        },
      ],
    },
    // The browser agent's one turn: it gives up.
    {
      text: JSON.stringify({
        kind: "give_up",
        reason: "The page is blank.",
        why: "nothing to click",
      }),
    },
    {
      calls: [
        {
          name: "save_finding",
          input: {
            text: "Returns are accepted within 30 days.",
            source: "https://shop.example.com/returns",
          },
        },
      ],
    },
    {
      calls: [
        {
          name: "write_report",
          input: {
            report:
              "The shop accepts returns within 30 days [https://shop.example.com/returns].",
          },
        },
      ],
    },
  ]);
  const actions: string[] = [];
  const run = await investigate("Return window?", model, {
    browser: async () => fakeBrowser(actions),
  });
  expect(toolResult(run.log, "browse_site")).toBe(
    "The browser could not finish (gave_up: The page is blank.). The page's text instead:\n\nReturns are accepted within 30 days.",
  );
  expect(actions).toEqual(["goto https://shop.example.com/returns", "close"]);
  expect(run.findings[0].source).toBe("https://shop.example.com/returns");
  expect(run.stopped).toBe("answered");
});

test("a browser that fails midway is tried once more, and both attempts are on the bill", async () => {
  let launches = 0;
  const browser = async () => {
    const page = fakeBrowser([]);
    if (launches++ === 0)
      page.click = async () => {
        throw new Error("Target closed");
      };
    return page;
  };
  const model = scripted([
    {
      calls: [
        {
          name: "browse_site",
          input: {
            url: "https://portal.example.com/",
            task: "Look up INV-4411.",
          },
        },
      ],
    },
    // The first attempt's one action, which the broken browser cannot do.
    {
      text: JSON.stringify({
        kind: "click",
        x: 200,
        y: 140,
        why: "focus the invoice field",
      }),
    },
    {
      text: JSON.stringify({
        kind: "done",
        result: "Paid on 2026-09-10 by ACH.",
        why: "the status is on screen",
      }),
    },
    {
      calls: [
        {
          name: "write_report",
          input: {
            report:
              "Invoice INV-4411 was paid on 2026-09-10 [https://portal.example.com/].",
          },
        },
      ],
    },
  ]);
  const run = await investigate("INV-4411?", model, { browser });
  expect(launches).toBe(2);
  expect(toolResult(run.log, "browse_site")).toBe("Paid on 2026-09-10 by ACH.");
  expect(run.report).toContain("2026-09-10");
  // The agent's 2 calls, and the browser agent's 2: one per attempt.
  const perCall = costOf("claude-haiku-5-5", { input: 100, output: 50 });
  expect(run.dollars).toBeCloseTo(4 * perCall, 12);
});

test("browse_site refuses a private address before the browser starts or anything is fetched", async () => {
  const fetched = vi.fn();
  vi.stubGlobal("fetch", fetched);
  const model = scripted([
    {
      calls: [
        {
          name: "browse_site",
          input: {
            url: "http://169.254.169.254/latest/meta-data",
            task: "Report what the page lists.",
          },
        },
      ],
    },
    {
      calls: [
        {
          name: "write_report",
          input: { report: "The address is not a public web address." },
        },
      ],
    },
  ]);
  const browser = vi.fn(async () => fakeBrowser([]));
  const run = await investigate(
    "What does http://169.254.169.254 serve?",
    model,
    {
      browser,
    },
  );
  const entry = run.log.find(
    (e) => e.kind === "tool" && e.name === "browse_site",
  );
  expect(entry).toMatchObject({ failed: true });
  expect(toolResult(run.log, "browse_site")).toContain(
    "not a public web address",
  );
  expect(browser).not.toHaveBeenCalled();
  expect(fetched).not.toHaveBeenCalled();
});

test("a run cut off by its limits reports the findings so far and says why", async () => {
  const model = scripted([
    {
      calls: [
        {
          name: "save_finding",
          input: {
            text: "Badges are issued by reception.",
            source: "Badge and access",
          },
        },
      ],
    },
    { calls: [{ name: "find", input: { query: "badge printer" } }] },
    { text: "Nothing more." },
  ]);
  const run = await investigate("Badge printer?", model, {
    limits: { steps: 2 },
  });
  expect(run.stopped).toBe("steps");
  expect(run.report).toContain(
    "Findings so far:\n- Badges are issued by reception. [Badge and access]",
  );
  expect(run.log.filter((e) => e.kind === "done")).toHaveLength(1);
});

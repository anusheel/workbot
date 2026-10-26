import { type LanguageModel, Output, generateText } from "ai";
import { z } from "zod";
import { chrome } from "./chrome";
import type { Usage } from "./providers";
import { isPublic } from "./web";

/** The few things the agent does to a page; Playwright is one implementation. */
export type Browser = {
  goto(url: string): Promise<void>;
  screenshot(): Promise<Uint8Array>;
  click(x: number, y: number): Promise<void>;
  type(text: string): Promise<void>;
  press(key: string): Promise<void>;
  scroll(dy: number): Promise<void>;
  wait(): Promise<void>;
  url(): string;
  close(): Promise<void>;
};

const Action = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("click"),
    x: z.number(),
    y: z.number(),
    why: z.string(),
  }),
  z.object({ kind: z.literal("type"), text: z.string(), why: z.string() }),
  z.object({
    kind: z.literal("press"),
    key: z.enum(["Enter", "Escape", "Tab"]),
    why: z.string(),
  }),
  z.object({ kind: z.literal("scroll"), dy: z.number(), why: z.string() }),
  z.object({ kind: z.literal("wait"), why: z.string() }),
  z.object({ kind: z.literal("goto"), url: z.url(), why: z.string() }),
  z.object({ kind: z.literal("done"), result: z.string(), why: z.string() }),
  z.object({ kind: z.literal("give_up"), reason: z.string(), why: z.string() }),
]);
export type Action = z.infer<typeof Action>;

export type BrowseEvents = {
  step?(step: number, action: Action): void;
  /** Each model call's tokens as it completes, so a caller can keep its own ledger. */
  spend?(usage: Usage): void;
};
export type BrowseResult = {
  outcome: "done" | "gave_up" | "steps";
  result: string;
  steps: number;
  usage: Usage;
};

export const viewport = { width: 1024, height: 768 };

const system = `You operate a web browser to complete a task for a colleague. On each turn you see a screenshot of the page (${viewport.width} by ${viewport.height} pixels) and the page's address. Reply with exactly one action: click (coordinates of the centre of the element), type (into the focused field, after clicking it), press a key, scroll (positive dy scrolls down), wait when the page is still loading, goto a URL, done with the result when the task is complete, or give_up with the reason when the page cannot be made to work after 2 attempts. Say why in a few words each time. Read the screen; never invent what it shows.`;

/**
 * The browser agent: look at the page, decide one action, do it, look again,
 * until the task is done or the step limit is reached.
 */
export async function browse(
  goal: string,
  start: string,
  model: LanguageModel,
  browser: Browser,
  { maxSteps = 12, on = {} as BrowseEvents } = {},
): Promise<BrowseResult> {
  await browser.goto(start);
  const history: string[] = [];
  const usage: Usage = { input: 0, output: 0 };
  for (let step = 1; step <= maxSteps; step++) {
    const screenshot = await browser.screenshot();
    const { output: action, usage: used } = await generateText({
      model,
      output: Output.object({ schema: Action }),
      instructions: system,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Task: ${goal}\nAddress: ${browser.url()}\nSo far: ${history.length ? history.join("; ") : "nothing yet"}`,
            },
            { type: "file", data: screenshot, mediaType: "image/png" },
          ],
        },
      ],
    });
    const spent = {
      input: used.inputTokens ?? 0,
      output: used.outputTokens ?? 0,
    };
    usage.input += spent.input;
    usage.output += spent.output;
    on.spend?.(spent);
    on.step?.(step, action);
    history.push(`${step}. ${action.kind}: ${action.why}`);
    switch (action.kind) {
      case "done":
        return { outcome: "done", result: action.result, steps: step, usage };
      case "give_up":
        return {
          outcome: "gave_up",
          result: action.reason,
          steps: step,
          usage,
        };
      case "click":
        await browser.click(action.x, action.y);
        break;
      case "type":
        await browser.type(action.text);
        break;
      case "press":
        await browser.press(action.key);
        break;
      case "scroll":
        await browser.scroll(action.dy);
        break;
      case "wait":
        await browser.wait();
        break;
      case "goto":
        await browser
          .goto(action.url)
          .catch((err: unknown) =>
            history.push(
              `page did not load: ${err instanceof Error ? err.message : err}`,
            ),
          );
        break;
    }
  }
  return {
    outcome: "steps",
    result: `Stopped after ${maxSteps} steps.`,
    steps: maxSteps,
    usage,
  };
}

/**
 * Where a browser started at `start` may go: that site, and the public web.
 * Pages are untrusted, so a link, a redirect or an address the model chooses
 * must not take the browser onto this machine or its network.
 */
export function bounds(start: string): (url: string) => boolean {
  const from = new URL(start);
  const site =
    from.protocol === "file:"
      ? from.href.slice(0, from.href.lastIndexOf("/") + 1)
      : `${from.origin}/`;
  return (url) => url.startsWith(site) || isPublic(new URL(url));
}

/** A headless Chrome with the agent's viewport, kept within the bounds of `start`. */
export async function chromeBrowser(start: string): Promise<Browser> {
  const allowed = bounds(start);
  const instance = await chrome();
  // The route sits on the context, so it sees every request from every page the
  // run opens, including popups, and no service worker can answer in its place.
  const context = await instance.newContext({
    viewport,
    serviceWorkers: "block",
  });
  await context.route("**/*", (route) =>
    allowed(route.request().url())
      ? route.continue()
      : route.abort("blockedbyclient"),
  );
  const page = await context.newPage();
  // A dialog would block every later action; dismiss it and let the agent see the result.
  page.on("dialog", (dialog) => void dialog.dismiss());
  return {
    goto: async (url) =>
      void (await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      })),
    screenshot: async () =>
      new Uint8Array(await page.screenshot({ type: "png" })),
    click: async (x, y) => page.mouse.click(x, y),
    type: async (text) => page.keyboard.type(text),
    press: async (key) => page.keyboard.press(key),
    scroll: async (dy) => page.mouse.wheel(0, dy),
    wait: () => page.waitForTimeout(1_000),
    url: () => page.url(),
    close: () => instance.close(),
  };
}

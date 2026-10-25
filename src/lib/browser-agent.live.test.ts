import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";
import { type Browser, browse, chromeBrowser } from "./browser-agent";
import { modelFor } from "./routing";

const portal = pathToFileURL(
  new URL("./fixtures/legacy-portal.html", import.meta.url).pathname,
).href;
let browser: Browser;
beforeAll(async () => (browser = await chromeBrowser(portal)));
afterAll(() => browser.close());

test("the agent works a legacy portal with no API by looking at the screen", async () => {
  const actions: string[] = [];
  const result = await browse(
    "Find the payment status of invoice INV-4411 and report it word for word.",
    portal,
    modelFor("read"),
    browser,
    {
      on: { step: (_, a) => actions.push(a.kind) },
    },
  );
  expect(result.outcome).toBe("done");
  expect(result.result).toMatch(/Paid on 2026-09-10/);
  expect(actions).toContain("type");
}, 240_000);

test("the browser refuses to leave its bounds, however it is sent there", async () => {
  await expect(browser.goto("http://127.0.0.1:1/")).rejects.toThrow(
    "ERR_BLOCKED_BY_CLIENT",
  );
});

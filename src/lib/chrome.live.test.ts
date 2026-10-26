import { chromium } from "playwright-core";
import { afterEach, expect, test } from "vitest";
import { chrome } from "./chrome";
import { config } from "./config";

afterEach(() => {
  config.browser.url = undefined;
});

async function heading(browser: Awaited<ReturnType<typeof chrome>>) {
  const page = await browser.newPage();
  await page.setContent("<h1>Fieldstone</h1>");
  const text = await page.textContent("h1");
  await browser.close();
  return text;
}

test("opens the machine's Chrome when no browser server is set", async () => {
  expect(await heading(await chrome())).toBe("Fieldstone");
});

test("connects to the browser server when one is set", async () => {
  const server = await chromium.launchServer({
    channel: "chrome",
    headless: true,
  });
  config.browser.url = server.wsEndpoint();
  try {
    expect(await heading(await chrome())).toBe("Fieldstone");
  } finally {
    await server.close();
  }
});

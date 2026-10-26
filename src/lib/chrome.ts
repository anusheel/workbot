import { chromium } from "playwright-core";
import { config } from "./config";

/**
 * A headless Chrome: the Playwright server's at `BROWSER_URL` when one is set,
 * as in a container or a function, else the one installed on this machine.
 */
export function chrome() {
  return config.browser.url
    ? chromium.connect(config.browser.url)
    : chromium.launch({ channel: "chrome", headless: true });
}

import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { VoiceLine } from "./voice-line";

test("starts off, offers to start the call, and takes typed input as well", () => {
  const html = renderToStaticMarkup(<VoiceLine />);
  expect(html).toContain("Off");
  expect(html).toContain("Start the call");
  expect(html).toContain('placeholder="Or type what happened"');
  expect(html).toContain("<canvas");
});

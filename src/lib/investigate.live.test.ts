import { expect, test } from "vitest";
import { modelFor } from "./routing";
import { investigate } from "./investigate";

test("the agent reads the knowledge base and the web on the small model, and reports with sources from both", async () => {
  const run = await investigate(
    "Operations wants to use The UPS Store at 2443 Fillmore St, San Francisco (https://locations.theupsstore.com/ca/san-francisco/2443-fillmore-st) for printing and shredding, about $4,000 a year. What does our vendor onboarding policy require before the first order, and which of those services does the store list?",
    modelFor("research"),
    { limits: { steps: 8, dollars: 0.3, seconds: 280 } },
  );
  expect(run.log.some((e) => e.kind === "tool" && e.name === "find")).toBe(
    true,
  );
  expect(
    run.log.some(
      (e) => e.kind === "tool" && ["read_url", "browse_site"].includes(e.name),
    ),
  ).toBe(true);
  expect(run.stopped).toBe("answered");
  expect(run.report).toMatch(/W-9/);
  expect(run.report).toMatch(/shredding/i);
  expect(run.findings.some((f) => f.source.includes("theupsstore.com"))).toBe(
    true,
  );
  expect(run.dollars).toBeLessThan(0.3);
}, 300_000);

import { expect, test } from "vitest";
import { modelFor } from "./routing";
import { investigate } from "./investigate";

test("the analyst asks the knowledge base and the web on the small model, and reports with sources from both", async () => {
  const run = await investigate(
    "Operations wants to use The UPS Store at 2443 Fillmore St, San Francisco (https://locations.theupsstore.com/ca/san-francisco/2443-fillmore-st) for printing and shredding, about $4,000 a year. What does our vendor onboarding policy require before the first order, and which of those services does the store list?",
    { analyst: modelFor("research"), specialist: modelFor("read") },
    { limits: { steps: 8, dollars: 0.3, seconds: 280 } },
  );
  expect(new Set(run.log.map((e) => e.agent))).toEqual(
    new Set(["analyst", "knowledge", "web"]),
  );
  expect(run.stopped).toBe("answered");
  expect(run.report).toMatch(/W-9/);
  expect(run.report).toMatch(/shredding/i);
  expect(run.findings.some((f) => f.source.includes("theupsstore.com"))).toBe(
    true,
  );
  expect(run.cost.knowledge).toBeGreaterThan(0);
  expect(run.cost.web).toBeGreaterThan(0);
  expect(run.dollars).toBeLessThan(0.3);
}, 300_000);

import { expect, test } from "vitest";
import { latestReport, saveReport } from "./reports";
import { createRequest } from "./requests";

test("the latest report is the one the ticket shows, with its findings and cost", async () => {
  const request = await createRequest({
    title: "Set up The UPS Store as a vendor",
    body: "",
    team: "operations",
    priority: "normal",
  });
  expect(await latestReport(request.id)).toBeUndefined();
  await saveReport(request.id, {
    report: "First.",
    findings: [],
    dollars: 0.01,
  });
  const second = await saveReport(request.id, {
    report: "A W-9 comes before the first order [Vendor onboarding].",
    findings: [
      {
        text: "A W-9 comes before the first order.",
        source: "Vendor onboarding",
      },
    ],
    dollars: 0.02,
  });
  expect(await latestReport(request.id)).toEqual(second);
  expect(second.findings).toEqual([
    {
      text: "A W-9 comes before the first order.",
      source: "Vendor onboarding",
    },
  ]);
  expect(second.dollars).toBe(0.02);
  expect(second.createdAt).toBeInstanceOf(Date);
});

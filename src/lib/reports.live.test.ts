import { expect, test } from "vitest";
import { latestReport, saveReport } from "./reports";
import { createRequest } from "./requests";

// The unit test runs on the embedded database; this one runs on the server's,
// through the other driver, which serializes a jsonb value its own way.
test("a report's findings come back parsed from the configured database", async () => {
  const request = await createRequest({
    title: "Driver check",
    body: "",
    team: "operations",
    priority: "low",
  });
  const findings = [
    { text: "Net 30 from the invoice date.", source: "Vendor onboarding" },
  ];
  await saveReport(request.id, {
    report: "Net 30 [Vendor onboarding].",
    findings,
    dollars: 0.001,
  });
  expect((await latestReport(request.id))?.findings).toEqual(findings);
});

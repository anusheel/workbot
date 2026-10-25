import { expect, test, vi } from "vitest";
import { createRequest } from "@/lib/requests";
import { POST } from "./route";

// The request context Next.js would provide; the model and the data are real.
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

test("a described dashboard streams as a page of catalog components", async () => {
  await createRequest({
    title: "Badge printer out of labels",
    body: "",
    team: "operations",
    priority: "high",
  });
  const response = await POST(
    new Request("http://workbot/api/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt:
          "A dashboard of open requests by team, with the latest requests in a table",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('"path":"/root"');
  expect(body).toMatch(/"type":"(BarChart|Metric|Table)"/);
  expect(body).toContain("Badge printer out of labels");
});

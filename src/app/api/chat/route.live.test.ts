import { expect, test, vi } from "vitest";
import { POST } from "./route";

// The request context Next.js would provide; the model and the tools are real.
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

test("the web chat streams a reply that used the calculator", async () => {
  const response = await POST(
    new Request("http://workbot/api/chat", {
      method: "POST",
      body: JSON.stringify({
        id: "live",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [
              {
                type: "text",
                text: "What is 1234 * 5678? Use the calculator.",
              },
            ],
          },
        ],
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('"toolName":"calculator"');
  expect(body.replace(/,/g, "")).toMatch(/7006652|7 006 652/);
});

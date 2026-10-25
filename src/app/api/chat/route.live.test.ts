import { expect, test, vi } from "vitest";
import { listMemories } from "@/lib/memory";
import { POST } from "./route";

// The request context Next.js would provide; the model, the tools and the database are real.
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/visitor", () => ({ visitorId: async () => "live-visitor" }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => fn() }));

test("the web chat answers with a tool and remembers what it learned about the person", async () => {
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
                text: "I run the support team and I like short answers. What is 1234 * 5678? Use the calculator.",
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
  await vi.waitFor(
    async () =>
      expect((await listMemories("live-visitor")).length).toBeGreaterThan(0),
    { timeout: 30_000 },
  );
});

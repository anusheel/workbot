import { expect, test, vi } from "vitest";
import { listMemories } from "@/lib/memory";
import { POST } from "./route";

// The request context Next.js would provide; the model and the database are real.
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/visitor", () => ({ visitorId: async () => "live-visitor" }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => fn() }));

test("the web chat answers a policy question from the knowledge base and remembers the person", async () => {
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
                text: "I work in support. How much can I refund on my own without the support lead?",
              },
            ],
          },
        ],
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain('"type":"text-delta"');
  expect(body).toMatch(/200/);
  expect(body).toMatch(/"toolName":"(find|cat|grep)"/);
  await vi.waitFor(
    async () =>
      expect((await listMemories("live-visitor")).length).toBeGreaterThan(0),
    { timeout: 30_000 },
  );
});

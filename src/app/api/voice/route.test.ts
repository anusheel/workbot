import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/visitor", () => ({ visitorId: async () => "visitor-1" }));
vi.mock("@/lib/routing", () => ({
  modelFor: () =>
    new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({ say: "Which printer is it?", done: false }),
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 10,
            noCache: 10,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      }),
    }),
}));

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/voice", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("a transcript gets the next line to say", async () => {
  const response = await post({
    turns: [{ role: "caller", text: "The badge printer is down." }],
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ say: "Which printer is it?" });
});

test("an empty or malformed transcript is rejected", async () => {
  expect((await post({ turns: [] })).status).toBe(400);
  expect((await post({ turns: [{ role: "robot", text: "x" }] })).status).toBe(
    400,
  );
});

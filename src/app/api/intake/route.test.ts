import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/chat", () => ({
  chatModel: () =>
    new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Refund order 4411",
              body: "Customer asks for a refund on order 4411.",
              team: "support",
              priority: "normal",
            }),
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
    new Request("http://workbot/api/intake", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("a message posted to intake becomes a request", async () => {
  const response = await post({
    message: "Hello, I would like a refund on order 4411, it arrived damaged.",
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    title: "Refund order 4411",
    team: "support",
    status: "open",
  });
});

test("a short or missing message is rejected", async () => {
  expect((await post({ message: "hi" })).status).toBe(400);
  expect((await post({})).status).toBe(400);
});

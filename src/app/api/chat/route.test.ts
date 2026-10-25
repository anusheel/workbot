import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/chat", () => ({
  chatTools: {},
  chatModel: () =>
    new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "Ask " },
            { type: "text-delta", id: "t", delta: "Finance." },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              logprobs: undefined,
              usage: {
                inputTokens: {
                  total: 3,
                  noCache: 3,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: { total: 2, text: 2, reasoning: undefined },
              },
            },
          ],
        }),
      }),
    }),
}));

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("streams the reply as a UI message stream", async () => {
  const response = await post({
    id: "c1",
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Hi" }] },
    ],
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const body = await response.text();
  expect(body).toContain('"type":"text-delta"');
  expect(body).toContain("Finance.");
});

test("rejects a body that is not a conversation", async () => {
  expect((await post({ messages: "no" })).status).toBe(400);
  expect((await post({ id: "c1", messages: [{ role: "user" }] })).status).toBe(
    400,
  );
});

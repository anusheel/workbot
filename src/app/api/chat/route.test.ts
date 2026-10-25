import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { listMemories, remember } from "@/lib/memory";
import { POST } from "./route";

let instructions = "";
const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/visitor", () => ({ visitorId: async () => "visitor-1" }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => fn() }));
vi.mock("@/lib/chat", () => ({
  chatTools: {},
  chatModel: (size = "large") =>
    new MockLanguageModelV4({
      // The small model extracts memories; the large one answers.
      doGenerate: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              memories:
                size === "small"
                  ? [
                      {
                        kind: "preference",
                        text: "The person wants short answers.",
                      },
                    ]
                  : [],
            }),
          },
        ],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
      doStream: async ({ prompt }) => {
        instructions = String(prompt.find((m) => m.role === "system")?.content);
        return {
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
                usage,
              },
            ],
          }),
        };
      },
    }),
}));

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("streams the reply, tells the model what it knows, and remembers what it learns", async () => {
  await remember("visitor-1", "entity", "The person works in finance.");
  const response = await post({
    id: "c1",
    messages: [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "Keep it short: who approves refunds?" }],
      },
    ],
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  const body = await response.text();
  expect(body).toContain("Finance.");
  expect(instructions).toContain("The person works in finance.");
  // Extraction runs after the response has gone out.
  await vi.waitFor(async () =>
    expect((await listMemories("visitor-1")).map((m) => m.text)).toEqual([
      "The person wants short answers.",
      "The person works in finance.",
    ]),
  );
});

test("rejects a body that is not a conversation", async () => {
  expect((await post({ messages: "no" })).status).toBe(400);
  expect((await post({ id: "c1", messages: [{ role: "user" }] })).status).toBe(
    400,
  );
});

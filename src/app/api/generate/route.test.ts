import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { POST } from "./route";

const lines = [
  '{"op":"add","path":"/root","value":"page"}',
  '{"op":"add","path":"/elements/page","value":{"type":"Page","props":{"title":"Operations","description":null},"children":[]}}',
];
let instructions = "";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/chat", () => ({
  chatModel: () =>
    new MockLanguageModelV4({
      doStream: async ({ prompt }) => {
        instructions = prompt.find((m) => m.role === "system")
          ?.content as string;
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: "text-start", id: "t" },
              ...lines.map((line) => ({
                type: "text-delta" as const,
                id: "t",
                delta: `${line}\n`,
              })),
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
        };
      },
    }),
}));

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

test("streams the model's JSONL patches as text, with the catalog and live data in the instructions", async () => {
  const response = await post({ prompt: "An operations dashboard" });
  expect(response.status).toBe(200);
  expect(await response.text()).toBe(lines.map((l) => `${l}\n`).join(""));
  expect(instructions).toContain("AVAILABLE COMPONENTS");
  expect(instructions).toContain('"byTeam"');
});

test("rejects an empty prompt", async () => {
  expect((await post({ prompt: "  " })).status).toBe(400);
});

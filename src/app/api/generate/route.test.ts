import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { POST } from "./route";
import { as } from "@/test/auth";

const lines = [
  '{"op":"add","path":"/root","value":"page"}',
  '{"op":"add","path":"/elements/page","value":{"type":"Page","props":{"title":"Operations","description":null},"children":[]}}',
];
let instructions = "";
let modelCalls = 0;

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/routing", () => ({
  modelFor: () =>
    new MockLanguageModelV4({
      doStream: async ({ prompt }) => {
        modelCalls += 1;
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

const agent = await as("agent");
const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/generate", {
      method: "POST",
      headers: agent,
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

test("rejects a spec with more than 200 elements before any model call", async () => {
  modelCalls = 0;
  const elements = Object.fromEntries(
    Array.from({ length: 5_000 }, (_, i) => [`e${i}`, { type: "Text" }]),
  );
  const response = await post({
    prompt: "Change it",
    currentSpec: { root: "e0", elements },
  });
  expect(response.status).toBe(400);
  expect((await response.json()).error.fieldErrors.currentSpec).toBeDefined();
  expect(modelCalls).toBe(0);
});

test("rejects a spec whose JSON is over 50,000 characters", async () => {
  modelCalls = 0;
  const response = await post({
    prompt: "Change it",
    currentSpec: { root: "a", elements: { a: { text: "x".repeat(50_000) } } },
  });
  expect(response.status).toBe(400);
  expect(modelCalls).toBe(0);
});

test("still streams an edit of a normal spec", async () => {
  const response = await post({
    prompt: "Change it",
    currentSpec: { root: "page", elements: { page: { type: "Page" } } },
  });
  expect(response.status).toBe(200);
  await response.text();
});

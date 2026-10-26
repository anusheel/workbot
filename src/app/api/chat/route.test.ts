import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { listMemories, remember } from "@/lib/memory";
import { allow } from "@/lib/rate-limit";
import { historyOf, saveHistory } from "@/lib/history";
import { POST } from "./route";

let instructions = "";
let systemBlocks: string[] = [];
let conversation: unknown[] = [];
const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};

const modelCalls = vi.hoisted(() => ({ count: 0 }));
const outage = vi.hoisted(() => ({ on: false }));
const summaryDown = vi.hoisted(() => ({ on: false }));

vi.mock("@/lib/rate-limit", () => ({ allow: vi.fn(() => true) }));
vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));
vi.mock("@/lib/visitor", () => ({ visitorId: async () => "visitor-1" }));
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => fn() }));
vi.mock("@/lib/chat", () => ({ chatToolsFor: () => ({}) }));
vi.mock("@/lib/routing", () => ({
  modelFor: (task: string) => {
    modelCalls.count++;
    return new MockLanguageModelV4({
      // The extract route extracts memories; the chat route answers.
      doGenerate: async () => {
        if (task === "summarize" && summaryDown.on)
          throw new Error("HTTP 503 from the provider");
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                memories:
                  task === "extract"
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
        };
      },
      doStream: async ({ prompt }) => {
        if (outage.on) throw new Error("HTTP 503 from the provider");
        // The prompt and the memory note are 2 system messages.
        systemBlocks = prompt
          .filter((m) => m.role === "system")
          .map((m) => String(m.content));
        instructions = systemBlocks.join("\n");
        conversation = prompt.filter((m) => m.role !== "system");
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
    });
  },
}));

const post = (body: unknown) =>
  POST(
    new Request("http://workbot/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

// Runs first: no memory is stored for the visitor yet.
test("a first message from a visitor with nothing known sends the prompt alone, never an empty block", async () => {
  const response = await POST(
    new Request("http://workbot/api/chat", {
      method: "POST",
      body: JSON.stringify({
        id: "c-new",
        messages: [
          {
            id: "m1",
            role: "user",
            parts: [{ type: "text", text: "Hello" }],
          },
        ],
      }),
    }),
  );
  expect(response.status).toBe(200);
  await response.text();
  expect(systemBlocks.every((block) => block.length > 0)).toBe(true);
  expect(systemBlocks).toHaveLength(1);
});
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

test("a rate-limited caller gets 429 and no model is called", async () => {
  vi.mocked(allow).mockReturnValueOnce(false);
  modelCalls.count = 0;
  const response = await post({
    id: "c1",
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
    ],
  });
  expect(response.status).toBe(429);
  expect(modelCalls.count).toBe(0);
});

test("rejects more than 200 messages and an empty or over-long id with field errors", async () => {
  const message = {
    id: "m",
    role: "user",
    parts: [{ type: "text", text: "Hi" }],
  };
  const tooMany = await post({
    id: "c1",
    messages: Array.from({ length: 201 }, () => message),
  });
  expect(tooMany.status).toBe(400);
  expect((await tooMany.json()).error.fieldErrors.messages).toBeDefined();
  for (const id of ["", "x".repeat(201)]) {
    const response = await post({ id, messages: [message] });
    expect(response.status).toBe(400);
    expect((await response.json()).error.fieldErrors.id).toBeDefined();
  }
});

test("when every model is down, the person gets a sentence, the page stays up and nothing is learned", async () => {
  outage.on = true;
  modelCalls.count = 0;
  const response = await post({
    id: "c-down",
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: "Hello" }] },
    ],
  });
  expect(response.status).toBe(200);
  // The model is called as the body is read, not before.
  const body = await response.text();
  outage.on = false;
  expect(body).toContain("WorkBot cannot reach its model right now");
  expect(body).not.toContain("HTTP 503");
  // The summary and the chat asked for a model; the extraction did not.
  expect(modelCalls.count).toBe(2);
});

test("a conversation past the budget whose summary cannot be written still gets its answer", async () => {
  summaryDown.on = true;
  const long = "The forklift manual, read aloud. ".repeat(4_000);
  const response = await post({
    id: "c-long",
    messages: [
      { id: "m1", role: "user", parts: [{ type: "text", text: long }] },
      { id: "m2", role: "assistant", parts: [{ type: "text", text: long }] },
      { id: "m3", role: "user", parts: [{ type: "text", text: "Hello" }] },
    ],
  });
  expect(response.status).toBe(200);
  const body = await response.text();
  summaryDown.on = false;
  expect(body).toContain("Finance.");
  expect(instructions).not.toContain("Earlier in this conversation");
});

test("a conversation continued on another channel reaches the model as the server keeps it, and is kept with the reply", async () => {
  const text = (
    id: string,
    role: "user" | "assistant",
    words: string,
    channel?: string,
  ) => ({
    id,
    role,
    parts: [{ type: "text" as const, text: words }],
    ...(channel && { metadata: { channel } }),
  });
  await saveHistory("c-phone", "visitor-1", [
    text("w1", "user", "Can you deliver on Friday?"),
    text("w2", "user", "Make it 40 bags.", "whatsapp"),
    text("w3", "assistant", "40 bags, Friday.", "whatsapp"),
  ]);
  // The browser saw only the first message, and adds a new one.
  const response = await post({
    id: "c-phone",
    messages: [
      text("w1", "user", "Can you deliver on Friday?"),
      text("m9", "user", "What time?"),
    ],
  });
  await response.text();
  expect(JSON.stringify(conversation)).toContain("Make it 40 bags.");
  const kept = await historyOf("c-phone", "visitor-1");
  expect(kept?.messages.map((m) => m.id).slice(0, 4)).toEqual([
    "w1",
    "w2",
    "w3",
    "m9",
  ]);
  expect(kept?.messages).toHaveLength(5);
});

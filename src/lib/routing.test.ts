import { APICallError } from "@ai-sdk/provider";
import { generateText, simulateReadableStream, streamText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test, vi } from "vitest";
import { query } from "./db";
import {
  aiModel,
  allRoutes,
  chain,
  modelFor,
  overridesOf,
  routes,
  tasks,
} from "./routing";

const env = vi.hoisted(() => ({
  routes: {} as Record<string, string | undefined>,
  outages: [] as string[],
}));
vi.mock("./config", async (importOriginal) => {
  const { config } = await importOriginal<typeof import("./config")>();
  return { config: { ...config, routes: env.routes, outages: env.outages } };
});

const usage = {
  inputTokens: {
    total: 10,
    noCache: 10,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const finishReason = { unified: "stop" as const, raw: undefined };

const answering = (text: string) =>
  new MockLanguageModelV4({
    modelId: "standing-in",
    doGenerate: async () => ({
      content: [{ type: "text", text }],
      finishReason,
      usage,
      warnings: [],
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: "text-start", id: "t" },
          { type: "text-delta", id: "t", delta: text },
          { type: "text-end", id: "t" },
          { type: "finish", finishReason, usage },
        ],
      }),
    }),
  });

const failing = (statusCode: number, isRetryable: boolean) => {
  const fail = async () => {
    throw new APICallError({
      message: `HTTP ${statusCode}`,
      url: "",
      requestBodyValues: {},
      statusCode,
      isRetryable,
    });
  };
  return new MockLanguageModelV4({ doGenerate: fail, doStream: fail });
};

test("a call the first model cannot take goes to the next", async () => {
  const first = failing(503, true);
  const second = answering("from the second");
  const { text } = await generateText({
    model: chain([first, second]),
    prompt: "hi",
    maxRetries: 0,
  });
  expect(text).toBe("from the second");
  expect(first.doGenerateCalls).toHaveLength(1);
});

test("a failure that would fail anywhere is not retried elsewhere", async () => {
  const second = answering("never");
  await expect(
    generateText({
      model: chain([failing(400, false), second]),
      prompt: "hi",
      maxRetries: 0,
    }),
  ).rejects.toThrow("HTTP 400");
  expect(second.doGenerateCalls).toHaveLength(0);
});

test("a stream falls back before it starts, and the last error stands when every model is down", async () => {
  const result = streamText({
    model: chain([failing(429, true), answering("streamed")]),
    prompt: "hi",
    maxRetries: 0,
  });
  expect(await result.text).toBe("streamed");
  await expect(
    generateText({
      model: chain([failing(503, true), failing(502, true)]),
      prompt: "hi",
      maxRetries: 0,
    }),
  ).rejects.toThrow("HTTP 502");
});

test("the outage flag fails a model before the network, traced, and the chain recovers", async () => {
  env.outages.push("claude-sonnet-5-5");
  const down = aiModel("anthropic", "claude-sonnet-5-5");
  await expect(
    generateText({ model: down, prompt: "hi", maxRetries: 0 }),
  ).rejects.toThrow("Simulated outage of claude-sonnet-5-5");
  const { text } = await generateText({
    model: chain([down, answering("the small model stands in")]),
    prompt: "hi",
    maxRetries: 0,
  });
  expect(text).toBe("the small model stands in");
  const [trace] = await query<{ ok: boolean; error: string }>(
    "select ok, error from traces where model = 'claude-sonnet-5-5' order by at desc limit 1",
  );
  expect(trace).toEqual({
    ok: false,
    error: "Simulated outage of claude-sonnet-5-5",
  });
  env.outages.length = 0;
});

test("every task has a route, and the table resolves to the providers' models", () => {
  for (const task of tasks) {
    expect(routes[task].length).toBeGreaterThan(0);
    for (const route of routes[task]) expect(allRoutes).toContain(route);
  }
  expect(modelFor("generate").modelId).toBe("claude-sonnet-5-5");
  expect(modelFor("chat").modelId).toBe("claude-haiku-5-5");
});

test("ROUTES names a task and a route, or the app does not start", () => {
  expect(overridesOf({ chat: "openai/large" })).toEqual({
    chat: "openai/large",
  });
  expect(() => overridesOf({ chat: "anthropic/medium" })).toThrow(
    '"chat=anthropic/medium" is not a task and a route',
  );
  expect(() => overridesOf({ chats: "anthropic/small" })).toThrow("Tasks:");
  expect(() => overridesOf({ chat: undefined })).toThrow("Routes:");
});

test("an override replaces a task's first model and keeps the rest behind it", async () => {
  env.routes.generate = "anthropic/small";
  vi.resetModules();
  const fresh = await import("./routing");
  expect(fresh.modelFor("generate").modelId).toBe("claude-haiku-5-5");
  delete env.routes.generate;
});

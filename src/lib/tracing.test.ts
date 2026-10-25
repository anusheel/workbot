import { MockLanguageModelV4 } from "ai/test";
import { generateText, streamText } from "ai";
import { expect, test } from "vitest";
import { query } from "./db";
import { recordTrace, traceSummary, traced, withTrace } from "./tracing";

const usage = {
  inputTokens: {
    total: 1000,
    noCache: 400,
    cacheRead: 600,
    cacheWrite: undefined,
  },
  outputTokens: { total: 50, text: 50, reasoning: undefined },
};
const model = () =>
  new MockLanguageModelV4({
    modelId: "claude-haiku-5-5",
    doGenerate: async () => ({
      content: [{ type: "text", text: "Fine." }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
    doStream: async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "text-start", id: "1" });
          controller.enqueue({ type: "text-delta", id: "1", delta: "Fine." });
          controller.enqueue({ type: "text-end", id: "1" });
          controller.enqueue({
            type: "finish",
            usage,
            finishReason: { unified: "stop", raw: undefined },
          });
          controller.close();
        },
      }),
    }),
  });

test("a call and a stream are recorded with their tenant, tokens, cached tokens, dollars and latency", async () => {
  await withTrace(
    { tenant: "visitor-1", name: "chat", prompt: "workbot/system@1" },
    async () => {
      await generateText({ model: traced(model()), prompt: "Hi" });
      const { text } = await streamText({
        model: traced(model()),
        prompt: "Hi",
      });
      await text;
    },
  );
  const rows = await query<{
    tenant: string;
    name: string;
    prompt: string;
    input: number;
    cached: number;
    dollars: number;
    ok: boolean;
  }>(
    `select tenant, name, prompt, input, cached, dollars, ok from traces where tenant = 'visitor-1' order by at`,
  );
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    tenant: "visitor-1",
    name: "chat",
    prompt: "workbot/system@1",
    input: 1000,
    cached: 600,
    ok: true,
  });
  // 400 fresh tokens at full price, 600 cached at a tenth, 50 out.
  expect(rows[0].dollars).toBeCloseTo((460 * 0.1 + 50 * 0.5) / 1e6, 12);
  expect(rows[1]).toMatchObject({ input: 1000, cached: 600 });
});

test("a failed call is recorded as one, with its reason, and the error still reaches the caller", async () => {
  const failing = new MockLanguageModelV4({
    modelId: "claude-haiku-5-5",
    doGenerate: async () => {
      throw new Error("overloaded");
    },
  });
  await expect(
    withTrace({ tenant: "api", name: "intake" }, () =>
      generateText({ model: traced(failing), prompt: "Hi" }),
    ),
  ).rejects.toThrow("overloaded");
  const [row] = await query<{ ok: boolean; error: string; name: string }>(
    `select ok, error, name from traces where tenant = 'api' order by at desc limit 1`,
  );
  expect(row).toMatchObject({ ok: false, error: "overloaded", name: "intake" });
});

test("the summary adds up the window by tenant and prompt, with latency percentiles", async () => {
  for (const [tenant, ms, ok] of [
    ["t1", 100, true],
    ["t1", 300, true],
    ["t2", 500, false],
  ] as const)
    await recordTrace({
      tenant,
      name: "chat",
      prompt: "p@1",
      model: "claude-haiku-5-5",
      input: 10,
      output: 5,
      cached: 0,
      dollars: 0.001,
      ms,
      ok,
      error: ok ? null : "boom",
    });
  const summary = await traceSummary(1);
  expect(summary.calls).toBeGreaterThanOrEqual(3);
  expect(summary.errors).toBeGreaterThanOrEqual(1);
  expect(summary.p95).toBeGreaterThanOrEqual(summary.p50);
  expect(summary.byTenant.find((t) => t.tenant === "t1")).toMatchObject({
    calls: 2,
  });
  expect(
    summary.byPrompt.find((p) => p.prompt === "p@1")?.calls,
  ).toBeGreaterThanOrEqual(3);
  expect(summary.recent[0].at).toBeInstanceOf(Date);
});

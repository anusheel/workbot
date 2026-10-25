import { expect, test } from "vitest";
import { anthropic, costOf, openai } from "./providers";
import { calculator } from "./tools";

const sse = (events: [string, object][]) =>
  new Response(
    events
      .map(
        ([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
      )
      .join(""),
    {
      headers: { "content-type": "text/event-stream" },
    },
  );

/** A fetch that answers from a queue of responses and keeps the request bodies. */
const capture = (...responses: Response[]) => {
  const requests: Record<string, unknown>[] = [];
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return responses.shift()!;
  };
  return { requests, fetch };
};

const completion = {
  model: "test-model",
  system: "Be brief.",
  messages: [{ role: "user" as const, content: "Hi" }],
  maxTokens: 64,
  effort: "low" as const,
};

const anthropicText = (text: string, stop = "end_turn") =>
  sse([
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "m",
          type: "message",
          role: "assistant",
          model: "test-model",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 12, output_tokens: 1 },
        },
      },
    ],
    [
      "content_block_start",
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      },
    ],
    [
      "content_block_delta",
      {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text },
      },
    ],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: stop, stop_sequence: null },
        usage: { output_tokens: 5 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ]);

const anthropicToolCall = (name: string, input: object, stop = "tool_use") =>
  sse([
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "m",
          type: "message",
          role: "assistant",
          model: "test-model",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 20, output_tokens: 1 },
        },
      },
    ],
    [
      "content_block_start",
      {
        type: "content_block_start",
        index: 0,
        content_block: { type: "tool_use", id: "toolu_1", name, input: {} },
      },
    ],
    [
      "content_block_delta",
      {
        type: "content_block_delta",
        index: 0,
        delta: {
          type: "input_json_delta",
          partial_json: JSON.stringify(input),
        },
      },
    ],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: stop, stop_sequence: null },
        usage: { output_tokens: 9 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ]);

test("anthropic streams text deltas and reports usage from the final message", async () => {
  const { requests, fetch } = capture(anthropicText("Hello"));
  let text = "";
  const usage = await anthropic({ apiKey: "test", fetch }).stream(completion, {
    text: (t) => (text += t),
  });
  expect(text).toBe("Hello");
  expect(usage).toEqual({ input: 12, output: 5 });
  expect(requests[0]).toMatchObject({
    model: "test-model",
    system: "Be brief.",
    max_tokens: 64,
    output_config: { effort: "low" },
  });
  expect(requests[0]).not.toHaveProperty("temperature");
  expect(requests[0]).not.toHaveProperty("tools");
});

test("anthropic runs a tool the model calls, sends the result back and sums the usage", async () => {
  const { requests, fetch } = capture(
    anthropicToolCall("calculator", { expression: "6 * 7" }),
    anthropicText("42."),
  );
  const calls: unknown[] = [];
  let text = "";
  const usage = await anthropic({ apiKey: "test", fetch }).stream(
    { ...completion, tools: [calculator] },
    { text: (t) => (text += t), tool: (call) => calls.push(call) },
  );
  expect(calls).toEqual([
    {
      name: "calculator",
      input: { expression: "6 * 7" },
      result: "42",
      failed: false,
    },
  ]);
  expect(text).toBe("42.");
  expect(usage).toEqual({ input: 32, output: 14 });
  expect(requests[0]).toMatchObject({
    tools: [
      {
        name: "calculator",
        input_schema: { type: "object", required: ["expression"] },
        eager_input_streaming: true,
      },
    ],
  });
  expect(requests[1].messages).toEqual([
    { role: "user", content: "Hi" },
    {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: "toolu_1",
          name: "calculator",
          input: { expression: "6 * 7" },
        },
      ],
    },
    {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "42" }],
    },
  ]);
});

test("anthropic runs nothing when a reply is cut off inside a tool call", async () => {
  const { requests, fetch } = capture(
    anthropicToolCall("calculator", { expression: "6 * 7" }, "max_tokens"),
  );
  const calls: unknown[] = [];
  const usage = await anthropic({ apiKey: "test", fetch }).stream(
    { ...completion, tools: [calculator] },
    { text: () => {}, tool: (call) => calls.push(call) },
  );
  expect(calls).toEqual([]);
  expect(requests).toHaveLength(1);
  expect(usage).toEqual({ input: 20, output: 9 });
});

test("anthropic returns a tool's error to the model as an error result", async () => {
  const { requests, fetch } = capture(
    anthropicToolCall("calculator", { expression: "2 +" }),
    anthropicText("Sorry."),
  );
  await anthropic({ apiKey: "test", fetch }).stream(
    { ...completion, tools: [calculator] },
    { text: () => {} },
  );
  expect(requests[1].messages).toMatchObject([
    {},
    {},
    {
      content: [
        {
          type: "tool_result",
          is_error: true,
          content: "Unexpected end of expression",
        },
      ],
    },
  ]);
});

const openaiCompleted = (output: object[], deltas: string[] = []) =>
  sse([
    ...deltas.map((delta, i): [string, object] => [
      "response.output_text.delta",
      {
        type: "response.output_text.delta",
        item_id: "i",
        output_index: 0,
        content_index: 0,
        delta,
        sequence_number: i,
      },
    ]),
    [
      "response.completed",
      {
        type: "response.completed",
        sequence_number: 99,
        response: {
          id: "r",
          object: "response",
          created_at: 0,
          status: "completed",
          model: "test-model",
          output,
          usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
        },
      },
    ],
  ]);

test("openai streams output text deltas and reports usage from the completed response", async () => {
  const { requests, fetch } = capture(openaiCompleted([], ["Hel", "lo"]));
  let text = "";
  const usage = await openai({ apiKey: "test", fetch }).stream(
    { ...completion, temperature: 0.2 },
    { text: (t) => (text += t) },
  );
  expect(text).toBe("Hello");
  expect(usage).toEqual({ input: 7, output: 3 });
  expect(requests[0]).toMatchObject({
    model: "test-model",
    instructions: "Be brief.",
    max_output_tokens: 64,
    reasoning: { effort: "low" },
    temperature: 0.2,
    stream: true,
  });
});

test("openai runs a function the model calls and sends the output back with the call id", async () => {
  const call = {
    type: "function_call",
    id: "fc_1",
    call_id: "call_1",
    name: "calculator",
    arguments: '{"expression":"6 * 7"}',
    status: "completed",
  };
  const { requests, fetch } = capture(
    openaiCompleted([call]),
    openaiCompleted([], ["42."]),
  );
  let text = "";
  const usage = await openai({ apiKey: "test", fetch }).stream(
    { ...completion, tools: [calculator] },
    { text: (t) => (text += t) },
  );
  expect(text).toBe("42.");
  expect(usage).toEqual({ input: 14, output: 6 });
  expect(requests[0]).toMatchObject({
    tools: [
      {
        type: "function",
        name: "calculator",
        strict: true,
        parameters: { type: "object", additionalProperties: false },
      },
    ],
  });
  expect(requests[1].input).toEqual([
    { role: "user", content: "Hi" },
    call,
    { type: "function_call_output", call_id: "call_1", output: "42" },
  ]);
});

test("openai keeps the usage of a response cut short, and reports a failed one", async () => {
  const cut = capture(
    sse([
      [
        "response.output_text.delta",
        {
          type: "response.output_text.delta",
          item_id: "i",
          output_index: 0,
          content_index: 0,
          delta: "Hel",
          sequence_number: 1,
        },
      ],
      [
        "response.incomplete",
        {
          type: "response.incomplete",
          sequence_number: 2,
          response: {
            id: "r",
            object: "response",
            created_at: 0,
            status: "incomplete",
            model: "test-model",
            output: [],
            incomplete_details: { reason: "max_output_tokens" },
            usage: { input_tokens: 7, output_tokens: 64, total_tokens: 71 },
          },
        },
      ],
    ]),
  );
  expect(
    await openai({ apiKey: "test", fetch: cut.fetch }).stream(completion, {
      text: () => {},
    }),
  ).toEqual({ input: 7, output: 64 });

  const failed = capture(
    sse([
      [
        "response.failed",
        {
          type: "response.failed",
          sequence_number: 1,
          response: {
            id: "r",
            object: "response",
            created_at: 0,
            status: "failed",
            model: "test-model",
            output: [],
            error: {
              code: "server_error",
              message: "The server had an error.",
            },
          },
        },
      ],
    ]),
  );
  await expect(
    openai({ apiKey: "test", fetch: failed.fetch }).stream(completion, {
      text: () => {},
    }),
  ).rejects.toThrow("The server had an error.");
});

test("a cache read is a tenth of the input price, a twentieth on the large models, and a write 1.25 times it", () => {
  expect(
    costOf("claude-haiku-5-5", { input: 0, output: 0, cacheRead: 1e6 }),
  ).toBeCloseTo(0.01, 6);
  expect(
    costOf("claude-sonnet-5-5", { input: 0, output: 0, cacheRead: 1e6 }),
  ).toBeCloseTo(0.1, 6);
  expect(
    costOf("claude-sonnet-5-5", { input: 0, output: 0, cacheWrite: 1e6 }),
  ).toBeCloseTo(2.5, 6);
  expect(costOf("gpt-5.5", { input: 1e6, output: 1e6 })).toBe(0);
});

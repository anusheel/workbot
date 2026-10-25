import { expect, test } from "vitest";
import { anthropic, openai } from "./providers";

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

const capture = (response: Response) => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
    return response;
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

test("anthropic streams text deltas and reports usage from the final message", async () => {
  const { requests, fetch } = capture(
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
          delta: { type: "text_delta", text: "Hel" },
        },
      ],
      [
        "content_block_delta",
        {
          type: "content_block_delta",
          index: 0,
          delta: { type: "text_delta", text: "lo" },
        },
      ],
      ["content_block_stop", { type: "content_block_stop", index: 0 }],
      [
        "message_delta",
        {
          type: "message_delta",
          delta: { stop_reason: "end_turn", stop_sequence: null },
          usage: { output_tokens: 5 },
        },
      ],
      ["message_stop", { type: "message_stop" }],
    ]),
  );
  let text = "";
  const usage = await anthropic({ apiKey: "test", fetch }).stream(
    completion,
    (t) => (text += t),
  );
  expect(text).toBe("Hello");
  expect(usage).toEqual({ input: 12, output: 5 });
  expect(requests[0].body).toMatchObject({
    model: "test-model",
    system: "Be brief.",
    max_tokens: 64,
    output_config: { effort: "low" },
  });
  expect(requests[0].body).not.toHaveProperty("temperature");
});

test("openai streams output text deltas and reports usage from the completed response", async () => {
  const { requests, fetch } = capture(
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
        "response.output_text.delta",
        {
          type: "response.output_text.delta",
          item_id: "i",
          output_index: 0,
          content_index: 0,
          delta: "lo",
          sequence_number: 2,
        },
      ],
      [
        "response.completed",
        {
          type: "response.completed",
          sequence_number: 3,
          response: {
            id: "r",
            object: "response",
            created_at: 0,
            status: "completed",
            model: "test-model",
            output: [],
            usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
          },
        },
      ],
    ]),
  );
  let text = "";
  const usage = await openai({ apiKey: "test", fetch }).stream(
    { ...completion, temperature: 0.2 },
    (t) => (text += t),
  );
  expect(text).toBe("Hello");
  expect(usage).toEqual({ input: 7, output: 3 });
  expect(requests[0].body).toMatchObject({
    model: "test-model",
    instructions: "Be brief.",
    max_output_tokens: 64,
    reasoning: { effort: "low" },
    temperature: 0.2,
    stream: true,
  });
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
    await openai({ apiKey: "test", fetch: cut.fetch }).stream(
      completion,
      () => {},
    ),
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
    openai({ apiKey: "test", fetch: failed.fetch }).stream(
      completion,
      () => {},
    ),
  ).rejects.toThrow("The server had an error.");
});

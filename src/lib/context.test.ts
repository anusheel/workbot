import type { UIMessage } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { compact, fitContext, sizeOf, summarize } from "./context";

const message = (
  id: string,
  role: "user" | "assistant",
  text: string,
): UIMessage => ({ id, role, parts: [{ type: "text", text }] });
const turns = (count: number, length: number) =>
  Array.from({ length: count }, (_, i) =>
    message(
      String(i),
      i % 2 ? "assistant" : "user",
      `${i} `.padEnd(length, "x"),
    ),
  );

test("a conversation within budget is untouched", () => {
  const messages = turns(6, 40);
  expect(fitContext(messages, 1_000)).toEqual({ kept: messages, dropped: [] });
});

test("over budget, the first message and the most recent ones stay; the middle is handed back", () => {
  const messages = turns(10, 400);
  const { kept, dropped } = fitContext(messages, sizeOf(messages[0]) * 4);
  expect(kept.map((m) => m.id)).toEqual(["0", "7", "8", "9"]);
  expect(dropped.map((m) => m.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
});

test("the last message is kept even when the first cannot fit beside it", () => {
  const messages = [
    message("0", "user", "x".repeat(4_000)),
    message("1", "assistant", "Noted."),
    message("2", "user", "And the refund limit?"),
  ];
  const { kept, dropped } = fitContext(messages, 200);
  expect(kept.map((m) => m.id)).toEqual(["1", "2"]);
  expect(dropped.map((m) => m.id)).toEqual(["0"]);
});

test("the last message is kept even when it alone is over budget", () => {
  const messages = [
    message("0", "user", "hi"),
    message("1", "assistant", "Noted."),
    message("2", "user", "x".repeat(4_000)),
  ];
  const { kept, dropped } = fitContext(messages, 200);
  expect(kept.map((m) => m.id)).toEqual(["2"]);
  expect(dropped.map((m) => m.id)).toEqual(["0", "1"]);

  const only = [messages[2]];
  expect(fitContext(only, 200)).toEqual({ kept: only, dropped: [] });
});

test("tool results count toward the budget", () => {
  const withTool: UIMessage = {
    id: "t",
    role: "assistant",
    parts: [
      {
        type: "tool-read_url",
        toolCallId: "1",
        state: "output-available",
        input: { url: "https://x.example" },
        output: "y".repeat(4_000),
      },
    ],
  };
  expect(sizeOf(withTool)).toBeGreaterThan(1_000);
  expect(
    fitContext(
      [message("0", "user", "hi"), withTool, message("2", "user", "and?")],
      500,
    ).dropped,
  ).toEqual([withTool]);
});

test("compact summarizes only what was dropped", async () => {
  let summarized = "";
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt }) => {
      summarized = String(
        (
          prompt.find((m) => m.role === "user")?.content as { text: string }[]
        )[0].text,
      );
      return {
        content: [
          { type: "text", text: "They agreed the printer needs labels." },
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
      };
    },
  });
  expect(await compact(turns(4, 40), model)).toEqual({
    messages: turns(4, 40),
    summary: undefined,
  });

  const messages = turns(10, 400);
  const result = await compact(messages, model, sizeOf(messages[0]) * 4);
  expect(result.summary).toBe("They agreed the printer needs labels.");
  expect(result.messages).toHaveLength(4);
  expect(summarized).toMatch(/^WorkBot: 1 /);
  expect(summarized).not.toContain("Person: 9 ");
  // Without a model, the cut is the same and nothing is summarized.
  expect(await compact(messages, undefined, sizeOf(messages[0]) * 4)).toEqual({
    messages: result.messages,
    summary: undefined,
  });
});

const recorder = () => {
  let prompt = "";
  const model = new MockLanguageModelV4({
    doGenerate: async ({ prompt: messages }) => {
      prompt = String(
        (
          messages.find((m) => m.role === "user")?.content as {
            text: string;
          }[]
        )[0].text,
      );
      return {
        content: [{ type: "text", text: "ok" }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: {
            total: 1,
            noCache: 1,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return { model, prompt: () => prompt };
};

test("the summarizer sees tool results, cut short", async () => {
  const { model, prompt } = recorder();
  await summarize(model, [
    message("0", "user", "Read the refunds page."),
    {
      id: "t",
      role: "assistant",
      parts: [
        {
          type: "tool-read_url",
          toolCallId: "1",
          state: "output-available",
          input: { url: "https://x.example" },
          output: "Refunds up to $200." + "z".repeat(1_000),
        },
        { type: "text", text: "Agents may refund up to $200." },
      ],
    },
  ]);
  expect(prompt()).toContain("[read_url: Refunds up to $200.");
  expect(prompt()).not.toContain("z".repeat(600));
  expect(prompt()).toContain("WorkBot: ");
});

test("the summarizer's own input is bounded", async () => {
  const { model, prompt } = recorder();
  await summarize(model, turns(40, 4_000), 2_000);
  expect(prompt().length).toBeLessThan(2_000 * 4 + 100);
  expect(prompt()).toMatch(/^\[earlier messages omitted\]/);
  expect(prompt()).toContain("WorkBot: 39 ");
});

import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { voiceTurn } from "./voice";

const scripted = (replies: object[]) =>
  new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(replies.shift()) }],
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
    }),
  });

test("the line asks until it knows enough, then files the request and says where it went", async () => {
  const model = scripted([
    { say: "Which printer, and is anyone waiting on it?", done: false },
    {
      say: "Thanks, I am filing that now; the team will follow up.",
      done: true,
    },
    {
      title: "Fix the warehouse badge printer",
      body: "The badge printer in the warehouse stopped this morning. 6 new starters are waiting.",
      team: "operations",
      priority: "high",
    },
  ]);
  const first = await voiceTurn(
    [{ role: "caller", text: "The badge printer stopped working." }],
    model,
  );
  expect(first).toEqual({ say: "Which printer, and is anyone waiting on it?" });
  const second = await voiceTurn(
    [
      { role: "caller", text: "The badge printer stopped working." },
      { role: "workbot", text: first.say },
      {
        role: "caller",
        text: "The one in the warehouse. 6 new starters are waiting.",
      },
    ],
    model,
  );
  expect(second.say).toBe(
    'Thanks, I am filing that now; the team will follow up. It is with the operations team as "Fix the warehouse badge printer".',
  );
  expect(second.request).toMatchObject({
    team: "operations",
    priority: "high",
    status: "open",
  });
});

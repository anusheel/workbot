import { MockLanguageModelV4 } from "ai/test";
import { expect, test } from "vitest";
import { intake } from "./intake";

const model = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          title: "Replace the badge printer labels",
          body: "The Zebra printer at reception is out of 4x6 labels.",
          team: "operations",
          priority: "high",
        }),
      },
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
  }),
});

test("a message becomes a triaged request in the queue", async () => {
  const request = await intake(
    "Hi! The Zebra printer at reception is out of 4x6 labels. Thanks, Dana",
    model,
  );
  expect(request).toMatchObject({
    title: "Replace the badge printer labels",
    team: "operations",
    priority: "high",
    status: "open",
  });
});

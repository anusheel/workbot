import { expect, test } from "vitest";
import { anthropic } from "./providers";

test("the small Anthropic model streams a reply and reports its usage", async () => {
  let text = "";
  const usage = await anthropic().stream(
    {
      model: "claude-haiku-5-5",
      system: "Answer in one word.",
      messages: [
        { role: "user", content: "What colour is a clear daytime sky?" },
      ],
      maxTokens: 20,
    },
    (delta) => (text += delta),
  );
  expect(text.toLowerCase()).toContain("blue");
  expect(usage.input).toBeGreaterThan(0);
  expect(usage.output).toBeGreaterThan(0);
});

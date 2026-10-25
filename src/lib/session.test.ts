import { expect, test, vi } from "vitest";
import type { Provider } from "./providers";
import { Session } from "./session";

const fake = (reply: string, usage = { input: 10, output: 5 }): Provider => ({
  name: "anthropic",
  models: [{ id: "fake", price: { input: 1, output: 10 } }],
  stream: vi.fn(async (_completion, onText) => {
    for (const part of reply.split(" ")) onText(part + " ");
    return usage;
  }),
});

test("a turn keeps both messages and the tokens it used", async () => {
  const session = new Session("anthropic");
  const provider = fake("Ask Finance.");
  session.provider = provider;
  session.model = provider.models[0];

  let streamed = "";
  await session.send("What is the meal limit?", (text) => (streamed += text));
  expect(streamed).toBe("Ask Finance. ");
  expect(session.messages).toEqual([
    { role: "user", content: "What is the meal limit?" },
    { role: "assistant", content: "Ask Finance. " },
  ]);
  expect(provider.stream).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "fake",
      system: session.system,
      maxTokens: 2048,
    }),
    expect.any(Function),
  );
  expect(session.cost()).toEqual({
    input: 10,
    output: 5,
    dollars: (10 * 1 + 5 * 10) / 1e6,
    unpriced: [],
  });
});

test("a failed turn leaves no trace in the history", async () => {
  const session = new Session("anthropic");
  session.provider = {
    ...fake(""),
    stream: vi.fn().mockRejectedValue(new Error("rate limited")),
  };
  await expect(session.send("hello", () => {})).rejects.toThrow("rate limited");
  expect(session.messages).toEqual([]);
});

test("switching models mid-conversation keeps the history and prices each turn by its model", async () => {
  const session = new Session("anthropic", "claude-haiku-5-5");
  expect(session.model).toEqual({
    id: "claude-haiku-5-5",
    price: { input: 0.1, output: 0.5 },
  });
  session.use("openai", "gpt-5.5-pro");
  expect(session.provider.name).toBe("openai");
  expect(session.model).toEqual({ id: "gpt-5.5-pro" });

  session.provider = fake("ok");
  await session.send("hi", () => {});
  expect(session.cost()).toMatchObject({
    dollars: 0,
    unpriced: ["gpt-5.5-pro"],
  });
});

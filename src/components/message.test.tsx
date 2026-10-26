import type { UIMessage } from "ai";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Message } from "./message";

test("a user message is plain text", () => {
  const html = renderToStaticMarkup(
    <Message
      message={{
        id: "u",
        role: "user",
        parts: [{ type: "text", text: "Is **this** bold?" }],
      }}
    />,
  );
  expect(html).toContain("Is **this** bold?");
  expect(html).not.toContain("<strong>");
});

test("an assistant message renders markdown and its tool calls by state", () => {
  const message: UIMessage = {
    id: "a",
    role: "assistant",
    parts: [
      {
        type: "tool-calculator",
        toolCallId: "t1",
        state: "input-available",
        input: { expression: "6 * 7" },
      },
      {
        type: "tool-web_search",
        toolCallId: "t2",
        state: "output-available",
        input: { query: "net 30" },
        output: "Payment terms\nhttps://e.example\nNet 30 means…",
      },
      {
        type: "tool-read_url",
        toolCallId: "t3",
        state: "output-error",
        input: { url: "https://x.example" },
        errorText: "x.example answered 404",
      },
      { type: "text", text: "The answer is **42**." },
    ],
  };
  const html = renderToStaticMarkup(<Message message={message} />);
  expect(html).toContain("Running calculator");
  expect(html).toContain("6 * 7");
  expect(html).toContain("Net 30 means…");
  expect(html).toContain("read_url failed");
  expect(html).toContain("x.example answered 404");
  expect(html).toContain("<strong>42</strong>");
});

test("a message that came by another channel says which", () => {
  const html = renderToStaticMarkup(
    <Message
      message={{
        id: "w1",
        role: "user",
        parts: [{ type: "text", text: "Still on for Friday?" }],
        metadata: { channel: "whatsapp" },
      }}
    />,
  );
  expect(html).toContain("Still on for Friday?");
  expect(html).toContain("via WhatsApp");
});

import { expect, test, vi } from "vitest";
import { scripted } from "@/test/model";
import { answer, slackMessage } from "./bot";
import { historyOf } from "./history";

test("a plain answer goes as markdown, and one that used tools as a card that names them", () => {
  expect(slackMessage({ text: "Friday at 9.", tools: [] })).toEqual({
    markdown: "Friday at 9.",
  });
  const card = slackMessage({
    text: "Ticket #42 is open.",
    tools: ["find_ticket", "find_ticket", "find_contact"],
  });
  expect(card).toMatchObject({ type: "card" });
  expect(JSON.stringify(card)).toContain("find ticket, find contact");
});

test("a Slack thread is a conversation: the mention is dropped, the reply posted, the thread kept", async () => {
  const thread = { id: "slack:C024BE91L:1729.1", post: vi.fn() };
  const { model, prompts } = scripted([
    { text: "The Oakland yard opens at 6." },
  ]);
  await answer(
    thread,
    {
      text: "<@U0WORKBOT> when does the Oakland yard open?",
      author: { userId: "U024BE7LH" } as never,
    },
    model,
  );
  expect(thread.post).toHaveBeenCalledWith({
    markdown: "The Oakland yard opens at 6.",
  });
  expect(JSON.stringify(prompts[0])).toContain(
    "when does the Oakland yard open?",
  );
  expect(JSON.stringify(prompts[0])).not.toContain("U0WORKBOT");
  const kept = await historyOf(`slack:${thread.id}`, "slack:U024BE7LH");
  expect(kept?.messages).toHaveLength(2);
});

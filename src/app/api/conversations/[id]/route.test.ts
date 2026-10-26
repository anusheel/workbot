import { expect, test, vi } from "vitest";
import { saveHistory } from "@/lib/history";
import { GET } from "./route";
import { ConversationResponse } from "./types";

vi.mock("@/lib/visitor", () => ({ visitorId: async () => "visitor-7" }));

const get = (id: string) =>
  GET(new Request(`http://workbot/api/conversations/${id}`), {
    params: Promise.resolve({ id }),
  });

test("a conversation comes back to its person with the channel each message came by", async () => {
  await saveHistory("chat-7", "visitor-7", [
    { id: "a", role: "user", parts: [{ type: "text", text: "Friday?" }] },
    {
      id: "b",
      role: "user",
      parts: [{ type: "text", text: "Still on?" }],
      metadata: { channel: "whatsapp" },
    },
  ]);
  const response = await get("chat-7");
  expect(response.status).toBe(200);
  const { messages } = ConversationResponse.parse(await response.json());
  expect(messages.map((m) => m.metadata?.channel)).toEqual([
    undefined,
    "whatsapp",
  ]);
});

test("someone else's conversation, or none, is not found", async () => {
  await saveHistory("chat-8", "visitor-8", [
    { id: "a", role: "user", parts: [{ type: "text", text: "Mine." }] },
  ]);
  expect((await get("chat-8")).status).toBe(404);
  expect((await get("chat-missing")).status).toBe(404);
});

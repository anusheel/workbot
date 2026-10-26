import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  type LanguageModel,
  type UIMessage,
  generateText,
  isStepCount,
} from "ai";
import { learn, prepare } from "./assistant";
import type { Access } from "./auth-model";
import { toolSet } from "./chat";
import { query } from "./db";
import { textOf } from "./context";
import { historyOf, saveHistory } from "./history";
import { listMemories } from "./memory";
import { promptOf } from "./prompts";
import { modelFor } from "./routing";
import { systemPrompt } from "./system-prompt";
import { toolsFor } from "./tools";
import { withTrace } from "./tracing";

export const channelNames = ["sms", "whatsapp", "slack"] as const;
export type Channel = (typeof channelNames)[number];

/** A message as every channel's adapter hands it over: the channel, the sender's address on it, the text, and the thread when the channel has threads. */
export type Inbound = {
  channel: Channel;
  address: string;
  text: string;
  thread?: string;
};

/** How each channel wants a reply written, told to the model and enforced on what it writes. */
const styles: Record<Channel, string> = {
  sms: "This reply goes by SMS: plain text with no markdown, links as bare addresses, at most 3 short sentences.",
  whatsapp:
    "This reply goes by WhatsApp: short paragraphs, *bold* for a key figure at most, no headings or tables, links as bare addresses.",
  slack:
    "This reply goes to a Slack thread: short, Slack-style markdown, no headings.",
};
const limits: Record<Channel, number> = {
  sms: 1600,
  whatsapp: 4096,
  slack: 12000,
};

/** A reply fitted to its channel: SMS gets plain text, WhatsApp its own bold, and each its length limit. */
export function render(text: string, channel: Channel): string {
  let out = text.trim();
  if (channel !== "slack") {
    out = out
      .replace(/\[([^\]]+)\]\((\S+?)\)/g, "$1 ($2)")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*\*(.+?)\*\*/g, channel === "whatsapp" ? "*$1*" : "$1");
    if (channel === "sms")
      out = out.replace(/(^|\s)[*_]([^*_\n]+)[*_]/g, "$1$2");
  }
  const limit = limits[channel];
  return out.length <= limit ? out : `${out.slice(0, limit - 1).trimEnd()}…`;
}

// No 0, O, 1 or I, so a code read off a screen is typed right; 32 letters, so each byte maps evenly.
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hash = (code: string) =>
  createHash("sha256").update(code.toUpperCase()).digest("hex");

/**
 * A one-time code that links whoever sends it, from a phone or a Slack
 * account, to this person and conversation: valid for 10 minutes, stored as
 * its hash. Sending it proves the sender holds both the session the code was
 * shown in and the account it came from, which is how two identities become
 * one person; a matching name or number never does.
 */
export async function linkCode(person: string, conversationId?: string) {
  const code = [...randomBytes(8)].map((byte) => alphabet[byte % 32]).join("");
  await query(
    `insert into link_codes (hash, person, conversation_id, expires_at) values ($1, $2, $3, now() + interval '10 minutes')`,
    [hash(code), person, conversationId ?? null],
  );
  return code;
}

type Sender = {
  person: string;
  conversationId: string;
  verified: boolean;
  optedOut: boolean;
};

/** The sender behind an address, met for the first time or again, with the moment of this message recorded for WhatsApp's 24-hour window. */
async function sender(channel: Channel, address: string): Promise<Sender> {
  const self = `${channel}:${address}`;
  const [row] = await query<Sender>(
    `insert into channels (channel, address, person, conversation_id, last_inbound_at) values ($1, $2, $3, $3, now())
     on conflict (tenant, channel, address) do update set last_inbound_at = now()
     returning person, conversation_id as "conversationId", verified_at is not null as verified, opted_out_at is not null as "optedOut"`,
    [channel, address, self],
  );
  return row;
}

/** Uses a link code: the address becomes the person who asked for it, and continues their conversation when the code named one. */
async function link(channel: Channel, address: string, code: string) {
  const [used] = await query<{ person: string; conversationId: string | null }>(
    `delete from link_codes where hash = $1 and expires_at > now() returning person, conversation_id as "conversationId"`,
    [hash(code)],
  );
  if (!used) return false;
  await query(
    `update channels set person = $3, conversation_id = coalesce($4, conversation_id), verified_at = now() where channel = $1 and address = $2`,
    [channel, address, used.person, used.conversationId],
  );
  return true;
}

/** What a linked person may do: a WorkBot user's role, and the customer's tools for anyone else. */
async function roleOf(person: string): Promise<Access> {
  const [user] = await query<{ role: Access }>(
    `select role from users where id::text = $1`,
    [person],
  );
  return user?.role ?? "public";
}

const message = (
  role: "user" | "assistant",
  text: string,
  channel: Channel,
): UIMessage<{ channel: Channel }> => ({
  id: randomUUID(),
  role,
  parts: [{ type: "text", text }],
  metadata: { channel },
});

/** A reply, the tools the turn used, and the conversation it was added to, for whatever runs after the reply is out. */
export type Reply = {
  text: string;
  tools: string[];
  turn?: { person: string; conversation: string };
};

/**
 * One inbound message through the same assistant the web runs: the sender
 * found or linked, their conversation loaded from wherever it began, the
 * turn taken with the tools their role reaches, the reply fitted to the
 * channel, and the conversation kept for the next message on any channel.
 * Nothing comes back for a sender who has opted out. What the exchange
 * taught about the person is learned after the reply is out (`learnFrom`).
 */
export async function respond(
  inbound: Inbound,
  model: LanguageModel = modelFor("chat"),
): Promise<Reply | undefined> {
  const { channel, address } = inbound;
  const text = inbound.text.trim();
  const keyword = text.toUpperCase();
  if (["STOP", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) {
    await sender(channel, address);
    await query(
      `update channels set opted_out_at = now() where channel = $1 and address = $2`,
      [channel, address],
    );
    return undefined;
  }
  if (keyword === "START") {
    await sender(channel, address);
    await query(
      `update channels set opted_out_at = null where channel = $1 and address = $2`,
      [channel, address],
    );
    return { text: "You will get messages here again.", tools: [] };
  }
  const linking = /^link\s+([A-Z2-9]{8})$/i.exec(text);
  if (linking) {
    await sender(channel, address);
    return (await link(channel, address, linking[1]))
      ? {
          text: "Linked. This chat now continues your conversation with WorkBot.",
          tools: [],
        }
      : {
          text: "That code is not valid or has expired. Ask for a new one where you got it.",
          tools: [],
        };
  }

  const { person, conversationId, optedOut } = await sender(channel, address);
  if (optedOut) return undefined;
  const id = inbound.thread ?? conversationId;
  const history = [
    ...((await historyOf(id, person))?.messages ?? []),
    message("user", text, channel),
  ];
  const role = await roleOf(person);
  const prompt = await promptOf("workbot/system", person, systemPrompt);
  return withTrace(
    {
      caller: person,
      name: "chat",
      role,
      user: role === "public" ? undefined : person,
      prompt: `workbot/system@${prompt.version}`,
    },
    async () => {
      const turn = await prepare({
        history,
        person,
        prompt: prompt.text,
        style: styles[channel],
      });
      const result = await generateText({
        model,
        instructions: turn.instructions,
        messages: turn.messages,
        tools: toolSet(toolsFor(role)),
        stopWhen: isStepCount(8),
      });
      const reply = render(result.text, channel);
      await saveHistory(id, person, [
        ...history,
        message("assistant", reply, channel),
      ]);
      return {
        text: reply,
        tools: result.steps.flatMap((step) =>
          step.toolCalls.map((call) => call.toolName),
        ),
        turn: { person, conversation: id },
      };
    },
  );
}

/** What the last exchange of a conversation taught about the person, kept for their next one on any channel. */
export async function learnFrom({
  person,
  conversation,
}: {
  person: string;
  conversation: string;
}) {
  const messages = (await historyOf(conversation, person))?.messages ?? [];
  const [user, assistant] = messages.slice(-2).map(textOf);
  if (user && assistant)
    await learn(person, { user, assistant }, await listMemories(person));
}

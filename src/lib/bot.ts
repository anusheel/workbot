import { createSlackAdapter } from "@chat-adapter/slack";
import type { LanguageModel } from "ai";
import {
  Card,
  CardText,
  Chat,
  Field,
  Fields,
  type Message,
  type Thread,
} from "chat";
import { type Reply, learnFrom, respond } from "./channels";
import { databaseState } from "./chat-state";
import { config } from "./config";

/** A reply as Slack shows it: markdown, or a card naming what the assistant looked up when it used its tools. */
export function slackMessage({ text, tools }: Reply) {
  if (tools.length === 0) return { markdown: text };
  const looked = [...new Set(tools)].map((name) => name.replaceAll("_", " "));
  return Card({
    children: [
      CardText(text),
      Fields([Field({ label: "Looked up", value: looked.join(", ") })]),
    ],
  });
}

/**
 * A Slack message through the assistant. The thread is the conversation;
 * the author's linked WorkBot account decides what the assistant may do,
 * and an unlinked author gets what a customer gets.
 */
export async function answer(
  thread: Pick<Thread, "id" | "post">,
  message: Pick<Message, "text" | "author">,
  model?: LanguageModel,
) {
  const reply = await respond(
    {
      channel: "slack",
      address: message.author.userId,
      // A mention opens the message; the rest is what was asked.
      text: message.text.replace(/^\s*(<@[^>]+>|@\S+)\s*/, ""),
      thread: `slack:${thread.id}`,
    },
    model,
  );
  if (reply) await thread.post(slackMessage(reply));
  return reply;
}

const { botToken, signingSecret, botUserId } = config.slack;

/** The Slack bot, when the Slack app is configured: a mention starts a thread it follows, and each reply in the thread continues it. */
export const bot =
  botToken && signingSecret
    ? new Chat({
        userName: "workbot",
        adapters: {
          slack: createSlackAdapter({ botToken, signingSecret, botUserId }),
        },
        state: databaseState(),
      })
    : undefined;

// What the exchange taught is learned once the reply is posted.
const handle = async (thread: Thread, message: Message) => {
  const reply = await answer(thread, message);
  if (reply?.turn) await learnFrom(reply.turn);
};
bot?.onNewMention(async (thread, message) => {
  await thread.subscribe();
  await handle(thread, message);
});
bot?.onSubscribedMessage(handle);

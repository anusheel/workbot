import { NonRetriableError } from "inngest";
import { learnFrom, respond } from "@/lib/channels";
import { deadLetter } from "@/lib/dead-letters";
import { Undeliverable, deliver, failUnsent, queue } from "@/lib/outbound";
import { inngest } from "./client";
import { failFast } from "./fail-fast";
import { messageReceived } from "./events";

/**
 * A text message answered: the assistant's turn, the reply queued, then
 * sent, each a step of its own. The send is retried with backoff when the
 * provider may recover, and not repeated once the provider's id is stored;
 * what the exchange taught is learned after the reply is out.
 */
export const channelReply = inngest.createFunction(
  {
    id: "channel-reply",
    retries: 3,
    // One run at a time per sender, so a person's messages are answered in the order they came; twenty in all.
    concurrency: [{ key: "event.data.address", limit: 1 }, { limit: 20 }],
    triggers: [messageReceived],
    // The run gave up: the reply it could not send says so, and the dead letters keep the message for a person.
    onFailure: async ({ event, error }) => {
      const received = event.data.event;
      await failUnsent(received.data.sid, error.message);
      await deadLetter(
        "job:channel-reply",
        received.data.address,
        { name: received.name, data: received.data },
        error,
      );
    },
  },
  async ({ event, step }) => {
    const { channel, address, text, sid } = event.data;
    const reply = await step.run("reply", () =>
      respond({ channel, address, text }).catch(failFast),
    );
    if (!reply) return { sent: false };
    const id = await step.run("queue", () =>
      queue(channel, address, reply.text, sid),
    );
    await step.run("send", async () => {
      try {
        return await deliver(id);
      } catch (error) {
        if (error instanceof Undeliverable)
          throw new NonRetriableError(error.message);
        throw error;
      }
    });
    const { turn } = reply;
    if (turn) await step.run("learn", () => learnFrom(turn));
    return { sent: true };
  },
);

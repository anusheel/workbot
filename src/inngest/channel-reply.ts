import { NonRetriableError } from "inngest";
import { learnFrom, respond } from "@/lib/channels";
import { Undeliverable, deliver, failUnsent, queue } from "@/lib/outbound";
import { inngest } from "./client";
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
    triggers: [messageReceived],
    // The run gave up: the reply it could not send says so, for a person to see.
    onFailure: ({ event, error }) =>
      failUnsent(event.data.event.data.sid, error.message),
  },
  async ({ event, step }) => {
    const { channel, address, text, sid } = event.data;
    const reply = await step.run("reply", () =>
      respond({ channel, address, text }),
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

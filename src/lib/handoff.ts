import type { UIMessage } from "ai";
import { z } from "zod";
import { textOf } from "./context";
import { customer } from "./customer";
import { createRequest } from "./requests";
import { tool } from "./tool";

/** Where a reply should go: the channel, and the address on it when there is one. */
export type ReplyTo = { channel: string; address?: string };

const names: Record<string, string> = {
  web: "the web chat",
  sms: "SMS",
  whatsapp: "WhatsApp",
  slack: "Slack",
};

/**
 * The hand-off to a person: a request for the team that looks after
 * customers, with the conversation so far and where to reply, so whoever
 * picks it up starts from what was said rather than from the beginning.
 */
export function handOff(transcript: () => UIMessage[], to: ReplyTo) {
  const where = names[to.channel] ?? to.channel;
  return tool({
    name: "hand_off",
    access: "public",
    description:
      "Hands the conversation to a person: files it as a request for the team, with the conversation so far and where to reply. Call it when the person asks for a human, or needs something you cannot do; then tell them a person will reply here.",
    input: z.object({
      reason: z.string().min(3).max(500).describe("why, in a few words"),
    }),
    run: async ({ reason }) => {
      const lines = transcript().map(
        (m) =>
          `${m.role === "user" ? "Customer" : customer.assistant}: ${textOf(m)}`,
      );
      // The newest lines matter most, and a request's body has a limit.
      const conversation = lines.join("\n").slice(-4500);
      // A long reason is clipped in the title, which has a limit, and kept whole in the body.
      const title = `Hand-off from ${where}: ${reason}`;
      const request = await createRequest({
        title: title.length > 120 ? `${title.slice(0, 119).trimEnd()}…` : title,
        body: `Reply on ${where}${to.address ? ` to ${to.address}` : ""}.\nReason: ${reason}\n\n${conversation}`,
        team: customer.filing.complaint,
        priority: "high",
      });
      return `Filed for the ${request.team} team as request ${request.id}; a person will reply on ${where}.`;
    },
  });
}

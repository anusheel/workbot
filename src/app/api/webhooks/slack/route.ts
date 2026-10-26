import { after } from "next/server";
import { bot } from "@/lib/bot";

/**
 * Slack's events, served by the Chat SDK: it checks Slack's signature,
 * answers within Slack's 3 seconds, drops a redelivered event, and runs the
 * handler after the response.
 */
export async function POST(request: Request) {
  if (!bot) return new Response(null, { status: 404 });
  return bot.webhooks.slack(request, {
    waitUntil: (task) => after(() => task),
  });
}

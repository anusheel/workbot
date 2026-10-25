import { cron } from "inngest";
import { githubConnect, githubEnabled } from "@/lib/github";
import { withMcp } from "@/lib/mcp";
import { pullTickets } from "@/lib/tickets";
import { inngest } from "./client";
import { ticketsSyncRequested } from "./events";

/**
 * The sync: every 15 minutes, the issues that changed since the last pull go
 * into the tickets table, so the tools and the page read a copy that is at
 * most that old and never wait on the ticketing system.
 */
export const syncTickets = inngest.createFunction(
  {
    id: "sync-tickets",
    triggers: [cron("*/15 * * * *"), ticketsSyncRequested],
  },
  async ({ step }) => {
    if (!githubEnabled()) return { pulled: 0, skipped: "no ticketing system" };
    return step.run("pull", () => withMcp(githubConnect, pullTickets));
  },
);

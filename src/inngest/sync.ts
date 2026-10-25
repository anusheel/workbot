import { cron } from "inngest";
import { githubConnect, githubEnabled } from "@/lib/github";
import { withMcp } from "@/lib/mcp";
import { pullTickets } from "@/lib/tickets";
import { syncContacts, syncRequests } from "@/lib/unified";
import { inngest } from "./client";
import { syncRequested } from "./events";

/** Every 15 minutes and on demand: the issues that changed, every request and every contact, into the one shape. */
export const sync = inngest.createFunction(
  { id: "sync", triggers: [cron("*/15 * * * *"), syncRequested] },
  async ({ step }) => ({
    issues: githubEnabled()
      ? await step.run("issues", () =>
          withMcp(githubConnect, (mcp) => pullTickets(mcp)),
        )
      : null,
    requests: await step.run("requests", syncRequests),
    contacts: await step.run("contacts", syncContacts),
  }),
);

/** Nightly: every issue read again, the rows the webhook and the pulls missed counted, the ones the system dropped removed. */
export const reconcile = inngest.createFunction(
  { id: "reconcile", triggers: [cron("30 3 * * *")] },
  async ({ step }) =>
    githubEnabled()
      ? step.run("issues", () =>
          withMcp(githubConnect, (mcp) => pullTickets(mcp, { full: true })),
        )
      : { skipped: "no ticketing system" },
);

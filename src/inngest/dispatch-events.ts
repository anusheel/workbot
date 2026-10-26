import { dispatch } from "@/lib/events";
import { inngest } from "./client";
import { dispatchRequested } from "./events";

/**
 * The domain events' delivery: every minute, or at once on request, each
 * consumer reads what is new to it. One run at a time, so a consumer's
 * events are handed over in the order they were written.
 */
export const dispatchEvents = inngest.createFunction(
  {
    id: "dispatch-events",
    concurrency: { limit: 1 },
    triggers: [{ cron: "* * * * *" }, dispatchRequested],
  },
  async ({ step }) => step.run("dispatch", () => dispatch()),
);

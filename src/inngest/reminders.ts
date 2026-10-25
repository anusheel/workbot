import { cron } from "inngest";
import { waitingSince } from "@/lib/inbox";
import { notify } from "@/lib/notify";
import { listRequests } from "@/lib/requests";
import { inngest } from "./client";
import { remindersRequested } from "./events";

const day = 24 * 60 * 60 * 1000;

/**
 * The scheduled agent: every morning, a nudge for each review nobody has
 * answered in a day, and a check-in on each request open for a week. One
 * step per notification, so a retry never repeats a sent one.
 */
export const reminders = inngest.createFunction(
  { id: "reminders", triggers: [cron("0 9 * * *"), remindersRequested] },
  async ({ step }) => {
    const waiting = await step.run("find-waiting", () => waitingSince(24));
    for (const item of waiting) {
      await step.run(`remind-${item.id}`, () =>
        notify(
          "reviewers",
          `Still waiting on ${item.name}: ${item.review.join(", ")}.`,
          "/admin/inbox",
        ),
      );
    }
    const stale = await step.run("find-stale", async () =>
      (await listRequests({ status: "open" })).filter(
        (request) => request.createdAt.getTime() < Date.now() - 7 * day,
      ),
    );
    for (const request of stale) {
      await step.run(`check-in-${request.id}`, () =>
        notify(
          request.team,
          `Still open after a week: ${request.title}.`,
          `/requests/${request.id}`,
        ),
      );
    }
    return { reminded: waiting.length, checkIns: stale.length };
  },
);

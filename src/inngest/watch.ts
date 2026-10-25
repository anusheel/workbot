import { cron } from "inngest";
import { config } from "@/lib/config";
import { notify } from "@/lib/notify";
import { traceSummary } from "@/lib/tracing";
import { inngest } from "./client";
import { watchRequested } from "./events";

/**
 * The alarm: every hour, the error rate of the last hour and the spend of
 * the last day against their limits; a breach goes to the outbox, where a
 * paging integration would pick it up.
 */
export const watch = inngest.createFunction(
  { id: "watch", triggers: [cron("0 * * * *"), watchRequested] },
  async ({ step }) => {
    const alerts = await step.run("check", async () => {
      const hour = await traceSummary(1);
      const day = await traceSummary(24);
      const found: string[] = [];
      if (hour.calls >= 10 && hour.errors / hour.calls > 0.1)
        found.push(
          `${hour.errors} of ${hour.calls} model calls failed in the last hour.`,
        );
      if (day.dollars > config.alerts.dailyDollars)
        found.push(
          `Spend in the last 24 hours is $${day.dollars.toFixed(2)}, over the $${config.alerts.dailyDollars} budget.`,
        );
      return found;
    });
    for (const [index, alert] of alerts.entries())
      await step.run(`alert-${index}`, () =>
        notify("ops", alert, "/admin/traces"),
      );
    return { alerts: alerts.length };
  },
);

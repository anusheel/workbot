import { cron } from "inngest";
import { applyRetention } from "@/lib/retention";
import { inngest } from "./client";

/** Nightly: what has outlived its retention window goes. */
export const retention = inngest.createFunction(
  { id: "retention", triggers: [cron("0 4 * * *")] },
  async ({ step }) => step.run("forget", applyRetention),
);

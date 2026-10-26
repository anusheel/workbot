import { measureCitations } from "@/lib/aeo";
import { inngest } from "./client";

/** Every Monday morning: the buyer questions to each assistant, and whether the site is cited. */
export const aeoWatch = inngest.createFunction(
  { id: "aeo-watch", triggers: [{ cron: "0 9 * * 1" }] },
  async ({ step }) => step.run("measure", () => measureCitations()),
);

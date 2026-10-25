import { Inngest } from "inngest";
import { config } from "@/lib/config";

/** The workflow engine's client. Without a signing key it is in dev mode, talking to the dev server (`pnpm inngest`). */
export const inngest = new Inngest({
  id: "workbot",
  eventKey: config.inngest.eventKey,
  signingKey: config.inngest.signingKey,
  isDev: !config.inngest.signingKey,
});

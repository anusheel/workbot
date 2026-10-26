import { Inngest } from "inngest";
import { config } from "@/lib/config";

/** The workflow engine's client. Without a signing key it is in dev mode, talking to the dev server (`pnpm inngest`); with one, Inngest Cloud, or a self-hosted engine at its base URL. */
export const inngest = new Inngest({
  id: "workbot",
  eventKey: config.inngest.eventKey,
  signingKey: config.inngest.signingKey,
  baseUrl: config.inngest.baseUrl,
  isDev: !config.inngest.signingKey,
});

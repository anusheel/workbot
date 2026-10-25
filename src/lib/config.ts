// NaN would make the watch's `spend > budget` never true, which turns the alert off.
function dailyDollars(value: string | undefined) {
  if (!value) return 5;
  const dollars = Number(value);
  if (Number.isFinite(dollars) && dollars > 0) return dollars;
  console.warn(
    `ALERT_DAILY_DOLLARS="${value}" is not a positive number; using 5`,
  );
  return 5;
}

// Comma-separated values, trimmed; none when unset.
const list = (value: string | undefined) =>
  value
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean) ?? [];

export const config = {
  env: process.env.VERCEL_ENV || process.env.NODE_ENV,
  commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
  // A postgres:// URL, or a directory for an embedded PGlite database.
  database: process.env.DATABASE_URL || ".data/pg",
  // A task's model instead of the routing table's first, as task=provider/size pairs:
  // "chat=anthropic/small,generate=anthropic/small".
  routes: Object.fromEntries(
    list(process.env.ROUTES).map(
      (pair) => pair.split("=") as [string, string | undefined],
    ),
  ),
  // Providers or model ids every call to which fails, to rehearse an outage:
  // "anthropic", or "claude-sonnet-5-5".
  outages: list(process.env.OUTAGE),
  // Embeddings for the knowledge base; unset means search by words.
  voyage: { key: process.env.VOYAGE_API_KEY },
  // The ticketing system: a GitHub token and the repository whose issues are the tickets; unset, the ticket tools and the sync are off.
  github: {
    token: process.env.GITHUB_TOKEN,
    repo: process.env.GITHUB_REPO,
    // Signs the webhook deliveries; unset, deliveries are refused.
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET,
  },
  // Web search for the assistant; unset means the tool is not offered.
  brave: { key: process.env.BRAVE_SEARCH_KEY },
  // The spend in a day that raises an alert.
  alerts: { dailyDollars: dailyDollars(process.env.ALERT_DAILY_DOLLARS) },
  // The workflow engine's keys for Inngest Cloud; unset, the app talks to the dev server.
  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
  },
  posthog: {
    // The project key, for capturing events; unset means no analytics.
    key: process.env.POSTHOG_KEY,
    host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
    // A personal key and project id, for reading events back.
    api: {
      host: process.env.POSTHOG_API_HOST || "https://us.posthog.com",
      projectId: process.env.POSTHOG_PROJECT_ID,
      personalKey: process.env.POSTHOG_PERSONAL_KEY,
    },
  },
};

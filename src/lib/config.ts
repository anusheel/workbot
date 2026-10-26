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
/** A customer id names a file and is set on every database connection, so it is a plain lowercase word with hyphens. */
function customerId(value = "fieldstone") {
  if (!/^[a-z][a-z0-9-]*$/.test(value))
    throw new Error(
      `CUSTOMER="${value}" is not a customer id: lowercase letters, digits and hyphens`,
    );
  return value;
}

const list = (value: string | undefined) =>
  value
    ?.split(",")
    .map((v) => v.trim())
    .filter(Boolean) ?? [];

// Set by Vercel on its builds, and by the image build everywhere else.
const commit = process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA;

export const config = {
  // The customer this deployment serves: a file in content/customers, and the tenant every row it writes belongs to.
  customer: customerId(process.env.CUSTOMER),
  env: process.env.VERCEL_ENV || process.env.NODE_ENV,
  commit: commit?.slice(0, 7) || "local",
  // A postgres:// URL, or a directory for an embedded PGlite database. Where a
  // platform sets a pooled and a direct URL, as Neon's integration does, the
  // direct one: a transaction pooler drops LISTEN and session advisory locks.
  database:
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ".data/pg",
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
  // Seals the tokens people connect: 32 bytes, base64. During a rotation the old key stays as the previous one until pnpm users reseal has run.
  secrets: {
    key: process.env.SECRETS_KEY,
    previous: process.env.SECRETS_KEY_PREVIOUS,
  },
  brave: { key: process.env.BRAVE_SEARCH_KEY },
  // The address the app is reached at from outside: a provider signs a webhook over the URL it called, so the check needs the same one.
  appUrl: process.env.APP_URL,
  // The domain the session cookie covers when the realtime server has a host of its
  // own beside the app's, workbot.example.com for app. and live.; unset, the app's host only.
  cookieDomain: process.env.COOKIE_DOMAIN,
  // Text messages through Twilio; unset, SMS and WhatsApp are off.
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    smsFrom: process.env.TWILIO_SMS_FROM,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM,
    // An approved WhatsApp template (a Content SID), for a message outside the 24-hour window.
    whatsappTemplate: process.env.TWILIO_WHATSAPP_TEMPLATE,
    // A regional API host, such as https://api.dublin.ie1.twilio.com, to keep messages in a region.
    api: process.env.TWILIO_API_URL || "https://api.twilio.com",
  },
  // A Playwright browser server, ws://…, for machines without Chrome: a container, a function. Unset, the machine's own Chrome.
  browser: { url: process.env.BROWSER_URL },
  // The realtime server's address, ws://…, for live calls; unset, a call is not shared with staff.
  realtime: { url: process.env.REALTIME_URL },
  // The Slack app; unset, the Slack channel is off.
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    // The bot's own user id (U…); with it, a cold start skips asking Slack who the bot is.
    botUserId: process.env.SLACK_BOT_USER_ID,
  },
  // The spend in a day that raises an alert.
  alerts: { dailyDollars: dailyDollars(process.env.ALERT_DAILY_DOLLARS) },
  // The workflow engine's keys for Inngest Cloud; unset, the app talks to the dev server.
  inngest: {
    eventKey: process.env.INNGEST_EVENT_KEY,
    signingKey: process.env.INNGEST_SIGNING_KEY,
    // A self-hosted engine's address; unset with keys, Inngest Cloud.
    baseUrl: process.env.INNGEST_BASE_URL,
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

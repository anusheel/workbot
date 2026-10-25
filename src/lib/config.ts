export const config = {
  env: process.env.VERCEL_ENV || process.env.NODE_ENV,
  commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
  // A postgres:// URL, or a directory for an embedded PGlite database.
  database: process.env.DATABASE_URL || ".data/pg",
  // The provider behind the web chat, and a model to use instead of its default.
  chat: {
    provider:
      process.env.CHAT_PROVIDER === "openai"
        ? ("openai" as const)
        : ("anthropic" as const),
    model: process.env.CHAT_MODEL,
  },
  // Embeddings for the knowledge base; unset means search by words.
  voyage: { key: process.env.VOYAGE_API_KEY },
  // Web search for the assistant; unset means the tool is not offered.
  brave: { key: process.env.BRAVE_SEARCH_KEY },
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

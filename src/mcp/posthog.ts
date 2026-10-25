import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export type PostHogApi = {
  host: string;
  projectId: string;
  personalKey: string;
  fetch?: typeof fetch;
};

type Event = {
  event: string;
  distinct_id: string;
  timestamp: string;
  properties: Record<string, unknown>;
};
type Definition = { name: string; last_seen_at: string | null };

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
const since = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

async function get<T>(
  api: PostHogApi,
  path: string,
  params: Record<string, string | undefined> = {},
): Promise<T[]> {
  const url = new URL(`/api/projects/${api.projectId}/${path}/`, api.host);
  for (const [name, value] of Object.entries(params))
    if (value) url.searchParams.set(name, value);
  const response = await (api.fetch ?? fetch)(url, {
    headers: { authorization: `Bearer ${api.personalKey}` },
  });
  if (!response.ok)
    throw new Error(`PostHog answered ${response.status} for ${path}`);
  return ((await response.json()) as { results: T[] }).results;
}

const events = (
  api: PostHogApi,
  params: {
    event?: string;
    distinctId?: string;
    minutes: number;
    limit?: number;
  },
) =>
  get<Event>(api, "events", {
    event: params.event,
    distinct_id: params.distinctId,
    after: since(params.minutes),
    limit: String(params.limit ?? 50),
  });

// Properties PostHog adds itself start with $; the ones the app sent are the interesting ones.
const own = (properties: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(properties).filter(([name]) => !name.startsWith("$")),
  );

/** Reads events back from PostHog, to check that the app captured what it should. */
export function posthogServer(api: PostHogApi) {
  const server = new McpServer({ name: "workbot-posthog", version: "1.0.0" });

  server.registerTool(
    "get-events",
    {
      description:
        "Recent events, newest first, filtered by name, visitor and time window.",
      inputSchema: {
        event: z.string().optional(),
        distinctId: z.string().optional(),
        minutes: z.number().int().positive().default(60),
        limit: z.number().int().positive().max(100).default(50),
      },
    },
    async (params) =>
      json(
        (await events(api, params)).map((e) => ({
          event: e.event,
          distinctId: e.distinct_id,
          timestamp: e.timestamp,
          properties: own(e.properties),
        })),
      ),
  );

  server.registerTool(
    "get-event-definitions",
    {
      description:
        "Every event name the project has seen, with when it was last seen.",
    },
    async () =>
      json(
        (await get<Definition>(api, "event_definitions")).map((d) => ({
          name: d.name,
          lastSeen: d.last_seen_at,
        })),
      ),
  );

  server.registerTool(
    "check-event-fired",
    {
      description:
        "Whether an event was captured in the last N minutes, and when it last fired.",
      inputSchema: {
        event: z.string(),
        minutes: z.number().int().positive().default(5),
      },
    },
    async ({ event, minutes }) => {
      const seen = await events(api, { event, minutes, limit: 100 });
      const text =
        seen.length === 0
          ? `${event} did not fire in the last ${minutes} minutes.`
          : `${event} fired ${seen.length} times in the last ${minutes} minutes, last at ${seen[0].timestamp}.`;
      return { content: [{ type: "text" as const, text }] };
    },
  );

  return server;
}

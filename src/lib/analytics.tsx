import { after } from "next/server";
import { config } from "./config";
import { visitorId } from "./visitor";

type Properties = Record<string, string | number | boolean>;

/** Records a product event for the current visitor, after the response. Without a PostHog key it does nothing. */
export async function track(event: string, properties: Properties = {}) {
  if (!config.posthog.key) return;
  const visitor = (await visitorId()) ?? "anonymous";
  after(() =>
    capture(event, visitor, properties).catch((err) =>
      console.error("[analytics]", err),
    ),
  );
}

/** Sends a product event for whoever it concerns, from a request or a background job alike. */
export async function capture(
  event: string,
  distinctId: string,
  properties: Properties = {},
) {
  const { key, host } = config.posthog;
  if (!key) return;
  const response = await fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      event,
      distinct_id: distinctId,
      properties,
      timestamp: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`PostHog answered ${response.status}`);
}

/** Tracks a view from inside a Suspense boundary, so the page around it can still prerender. */
export async function Track({
  event,
  ...properties
}: { event: string } & Properties) {
  await track(event, properties);
  return null;
}

import { cookies } from "next/headers";
import { after } from "next/server";
import { config } from "./config";

type Properties = Record<string, string | number | boolean>;

/** Records a product event for the current visitor. Without a PostHog key it does nothing. */
export async function track(event: string, properties: Properties = {}) {
  const { key, host } = config.posthog;
  if (!key) return;
  const distinctId = (await cookies()).get("visitor")?.value ?? "anonymous";
  const body = JSON.stringify({
    api_key: key,
    event,
    distinct_id: distinctId,
    properties,
    timestamp: new Date().toISOString(),
  });
  after(() =>
    fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }).catch((err) => console.error("[analytics]", err)),
  );
}

/** Tracks a view from inside a Suspense boundary, so the page around it can still prerender. */
export async function Track({
  event,
  ...properties
}: { event: string } & Properties) {
  await track(event, properties);
  return null;
}

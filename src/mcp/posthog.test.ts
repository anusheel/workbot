import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, expect, test } from "vitest";
import { posthogServer } from "./posthog";

const requests: URL[] = [];
const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(String(input));
  requests.push(url);
  const results = url.pathname.endsWith("/event_definitions/")
    ? [{ name: "request_submitted", last_seen_at: "2026-10-24T10:00:00Z" }]
    : url.searchParams.get("event") === "request_viewed"
      ? []
      : [
          {
            event: "request_submitted",
            distinct_id: "visitor-1",
            timestamp: "2026-10-24T10:00:00Z",
            properties: { team: "finance", $ip: "10.0.0.1", $lib: "fetch" },
          },
        ];
  return new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json" },
  });
};

const client = new Client({ name: "test", version: "1.0.0" });
const text = (result: Awaited<ReturnType<typeof client.callTool>>) =>
  (result.content as { text: string }[])[0].text;

beforeAll(async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = posthogServer({
    host: "https://us.posthog.com",
    projectId: "42",
    personalKey: "phx_test",
    fetch: fakeFetch,
  });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

test("get-events queries the project with the filters and strips PostHog's own properties", async () => {
  const result = JSON.parse(
    text(
      await client.callTool({
        name: "get-events",
        arguments: { event: "request_submitted", minutes: 30 },
      }),
    ),
  );
  expect(result).toEqual([
    {
      event: "request_submitted",
      distinctId: "visitor-1",
      timestamp: "2026-10-24T10:00:00Z",
      properties: { team: "finance" },
    },
  ]);
  const url = requests.at(-1)!;
  expect(url.pathname).toBe("/api/projects/42/events/");
  expect(url.searchParams.get("event")).toBe("request_submitted");
  expect(url.searchParams.get("after")).toMatch(/^\d{4}-/);
});

test("get-event-definitions lists names with last seen", async () => {
  const result = JSON.parse(
    text(await client.callTool({ name: "get-event-definitions" })),
  );
  expect(result).toEqual([
    { name: "request_submitted", lastSeen: "2026-10-24T10:00:00Z" },
  ]);
});

test("check-event-fired answers in a sentence either way", async () => {
  expect(
    text(
      await client.callTool({
        name: "check-event-fired",
        arguments: { event: "request_submitted" },
      }),
    ),
  ).toBe(
    "request_submitted fired 1 times in the last 5 minutes, last at 2026-10-24T10:00:00Z.",
  );
  expect(
    text(
      await client.callTool({
        name: "check-event-fired",
        arguments: { event: "request_viewed", minutes: 10 },
      }),
    ),
  ).toBe("request_viewed did not fire in the last 10 minutes.");
});

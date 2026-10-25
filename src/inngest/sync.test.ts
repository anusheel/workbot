import { InngestTestEngine } from "@inngest/test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { connectMcp } from "@/lib/mcp";
import { createRequest } from "@/lib/requests";
import { listContacts, listTickets } from "@/lib/unified";
import { reconcile, sync } from "./sync";

const enabled = vi.hoisted(() => {
  process.env.GITHUB_REPO = "acme/helpdesk";
  return { on: false };
});

vi.mock("@/lib/github", () => ({
  githubEnabled: () => enabled.on,
  githubConnect: async () => {
    const server = new McpServer({ name: "github", version: "1.0.0" });
    server.registerTool(
      "list_issues",
      { inputSchema: { state: z.enum(["OPEN", "CLOSED"]).optional() } },
      async ({ state }) => ({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              issues:
                state === "CLOSED"
                  ? []
                  : [
                      {
                        number: 7,
                        title: "Loading dock light",
                        state: "OPEN",
                        user: { login: "sam" },
                        updated_at: "2026-10-20T08:00:00Z",
                      },
                    ],
            }),
          },
        ],
      }),
    );
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await server.connect(transport);
    return connectMcp(client);
  },
}));

const run = (fn: typeof sync | typeof reconcile) =>
  new InngestTestEngine({ function: fn }).execute();

test("without a ticketing system, the requests still become tickets in the one shape", async () => {
  await createRequest({
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "high",
  });
  expect((await run(sync)).result).toEqual({
    issues: null,
    requests: 1,
    contacts: 0,
  });
  expect((await listTickets()).map((t) => [t.source, t.team])).toEqual([
    ["workbot", "operations"],
  ]);
});

test("with one, the changed issues come too, routed, and their logins become contacts", async () => {
  enabled.on = true;
  expect((await run(sync)).result).toMatchObject({
    issues: { pulled: 1 },
    requests: 1,
    contacts: 1,
  });
  expect((await listTickets()).map((t) => [t.source, t.team])).toEqual([
    ["workbot", "operations"],
    ["github", "operations"],
  ]);
  expect((await listContacts()).map((c) => c.name)).toEqual(["sam"]);
});

test("the nightly reconciliation reads every issue and finds nothing missed when nothing was", async () => {
  expect((await run(reconcile)).result).toMatchObject({
    pulled: 1,
    missed: 0,
    gone: 0,
  });
});

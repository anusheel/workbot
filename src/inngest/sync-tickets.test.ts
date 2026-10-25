import { InngestTestEngine } from "@inngest/test";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, test, vi } from "vitest";
import { connectMcp } from "@/lib/mcp";
import { listTickets } from "@/lib/tickets";
import { syncTickets } from "./sync-tickets";

const enabled = vi.hoisted(() => {
  process.env.GITHUB_REPO = "acme/helpdesk";
  return { on: false };
});

vi.mock("@/lib/github", () => ({
  githubEnabled: () => enabled.on,
  githubConnect: async () => {
    const server = new McpServer({ name: "github", version: "1.0.0" });
    server.registerTool("list_issues", {}, async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            issues: [
              {
                number: 7,
                title: "Loading dock light",
                state: "OPEN",
                updated_at: "2026-10-20T08:00:00Z",
              },
            ],
          }),
        },
      ],
    }));
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await server.connect(transport);
    return connectMcp(client);
  },
}));

const run = () => new InngestTestEngine({ function: syncTickets }).execute();

test("does nothing without a ticketing system", async () => {
  expect((await run()).result).toEqual({
    pulled: 0,
    skipped: "no ticketing system",
  });
  expect(await listTickets()).toEqual([]);
});

test("pulls the changed issues into the tickets table", async () => {
  enabled.on = true;
  expect((await run()).result).toMatchObject({ pulled: 1 });
  expect((await listTickets()).map((t) => t.title)).toEqual([
    "Loading dock light",
  ]);
});

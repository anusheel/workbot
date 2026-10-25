import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { githubTools } from "./github";
import { connectMcp } from "./mcp";
import { listTickets, pullTickets } from "./tickets";

vi.hoisted(() => {
  process.env.GITHUB_REPO = "acme/helpdesk";
});

type Issue = {
  number: number;
  title: string;
  body: string;
  state: "OPEN" | "CLOSED";
  assignees: { login: string }[];
  labels: string[];
  updated_at: string;
};

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value) }],
});

/** A ticketing system in memory with the three GitHub tools the app calls; it pages by two so the cursor loop runs. */
function fakeGitHub() {
  const issues: Issue[] = [1, 2, 3].map((n) => ({
    number: n,
    title: ["Badge printer jams", "Van 3 brake light", "Invoice 4471 unpaid"][
      n - 1
    ],
    body: "",
    state: "OPEN",
    assignees: n === 1 ? [{ login: "sam" }] : [],
    labels: n === 3 ? ["finance"] : [],
    updated_at: `2026-10-0${n}T00:00:00Z`,
  }));
  const comments: { issue: number; body: string }[] = [];
  const since: (string | undefined)[] = [];
  const serve = () => {
    const server = new McpServer({ name: "github", version: "1.0.0" });
    server.registerTool(
      "list_issues",
      {
        inputSchema: {
          owner: z.string(),
          repo: z.string(),
          perPage: z.number(),
          orderBy: z.string(),
          direction: z.string(),
          since: z.string().optional(),
          after: z.string().optional(),
        },
      },
      async (args) => {
        since.push(args.since);
        const changed = issues
          .filter(
            (i) =>
              !args.since || new Date(i.updated_at) >= new Date(args.since),
          )
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
        const start = Number(args.after ?? 0);
        const page = changed.slice(start, start + 2);
        return json({
          issues: page,
          pageInfo: {
            hasNextPage: start + 2 < changed.length,
            endCursor: String(start + 2),
          },
        });
      },
    );
    server.registerTool(
      "issue_write",
      {
        inputSchema: {
          method: z.enum(["create", "update"]),
          owner: z.string(),
          repo: z.string(),
          title: z.string(),
          body: z.string(),
        },
      },
      async ({ title, body }) => {
        const number = issues.length + 1;
        issues.push({
          number,
          title,
          body,
          state: "OPEN",
          assignees: [],
          labels: [],
          updated_at: new Date().toISOString(),
        });
        return json({
          id: String(number),
          url: `https://github.com/acme/helpdesk/issues/${number}`,
        });
      },
    );
    server.registerTool(
      "add_issue_comment",
      {
        inputSchema: {
          owner: z.string(),
          repo: z.string(),
          issue_number: z.number(),
          body: z.string(),
        },
      },
      async ({ issue_number, body }) => {
        if (fake.failNext) {
          fake.failNext = false;
          return { content: [{ type: "text", text: "down" }], isError: true };
        }
        comments.push({ issue: issue_number, body });
        return json({
          id: String(comments.length),
          url: `https://github.com/acme/helpdesk/issues/${issue_number}#issuecomment-${comments.length}`,
        });
      },
    );
    return server;
  };
  const connect = async () => {
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await serve().connect(transport);
    return connectMcp(client);
  };
  const fake = { issues, comments, since, connect, failNext: false };
  return fake;
}

const github = fakeGitHub();
const tools = Object.fromEntries(
  githubTools(github.connect).map((t) => [t.name, t]),
);

test("pulls the issues that changed since the last sync, a page at a time", async () => {
  const mcp = await github.connect();
  expect(await pullTickets(mcp)).toEqual({ pulled: 3, since: null });
  expect(github.since).toEqual([undefined, undefined]);

  github.issues[1].state = "CLOSED";
  github.issues[1].updated_at = "2026-10-09T00:00:00Z";
  // `since` is inclusive at GitHub, so the newest row of the last pull comes again.
  const second = await pullTickets(mcp);
  expect(second.pulled).toBe(2);
  expect(second.since?.toISOString()).toBe("2026-10-03T00:00:00.000Z");

  const tickets = await listTickets();
  expect(tickets.map((t) => [t.number, t.state])).toEqual([
    [2, "closed"],
    [3, "open"],
    [1, "open"],
  ]);
  expect(tickets[2]).toMatchObject({
    id: "acme/helpdesk#1",
    source: "acme/helpdesk",
    assignee: "sam",
    url: "https://github.com/acme/helpdesk/issues/1",
  });
  await mcp.close();
});

test("finds tickets in the synced copy", async () => {
  expect(await tools.find_ticket.run({ query: "printer" })).toBe(
    "#1 (open, sam) Badge printer jams https://github.com/acme/helpdesk/issues/1",
  );
  expect(await tools.find_ticket.run({ query: "espresso" })).toBe(
    'No ticket matches "espresso".',
  );
});

test("files a ticket once per key, and not at all on a dry run", async () => {
  const input = {
    title: "Badge printer out of toner",
    body: "Reported by reception.",
    key: "REQ-88",
  };
  expect(await tools.file_ticket.run({ ...input, dry_run: true })).toMatch(
    /^Would file .* Nothing filed\.$/,
  );
  expect(github.issues).toHaveLength(3);

  expect(await tools.file_ticket.run(input)).toBe(
    "Filed #4: https://github.com/acme/helpdesk/issues/4",
  );
  expect(github.issues[3].body).toBe(
    "Reported by reception.\n\nFiled by WorkBot (REQ-88).",
  );
  expect(await tools.file_ticket.run({ ...input, title: "Again" })).toBe(
    "Already filed as #4: https://github.com/acme/helpdesk/issues/4",
  );
  expect(github.issues).toHaveLength(4);
});

test("two filings with one key at the same time make one issue", async () => {
  const input = { title: "Van 3 brake light", key: "REQ-90" };
  const results = await Promise.all([
    tools.file_ticket.run(input),
    tools.file_ticket.run(input),
  ]);
  expect(github.issues).toHaveLength(5);
  expect(results.filter((r) => r.startsWith("Filed #5:"))).toHaveLength(1);
});

test("a write that fails gives its key back", async () => {
  const input = { number: 1, text: "x", key: "REQ-91" };
  github.failNext = true;
  await expect(tools.comment_on_ticket.run(input)).rejects.toThrow("down");
  expect(await tools.comment_on_ticket.run(input)).toBe(
    "Commented on #1: https://github.com/acme/helpdesk/issues/1#issuecomment-1",
  );
});

test("comments on a ticket once per key", async () => {
  const input = { number: 1, text: "Toner ordered.", key: "REQ-88-toner" };
  expect(await tools.comment_on_ticket.run(input)).toBe(
    "Commented on #1: https://github.com/acme/helpdesk/issues/1#issuecomment-2",
  );
  expect(await tools.comment_on_ticket.run(input)).toBe(
    "Already commented on #1: https://github.com/acme/helpdesk/issues/1#issuecomment-2",
  );
  expect(github.comments).toEqual([
    { issue: 1, body: "x" },
    { issue: 1, body: "Toner ordered." },
  ]);
});

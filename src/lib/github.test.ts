import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, test, vi } from "vitest";
import { z } from "zod";
import { query } from "./db";
import { githubTools } from "./github";
import { connectMcp } from "./mcp";
import { pullTickets } from "./tickets";
import { lastSync, listTickets } from "./unified";

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
const failure = (text: string) => ({
  content: [{ type: "text" as const, text }],
  isError: true,
});
const issueUrl = (number: number) =>
  `https://github.com/acme/helpdesk/issues/${number}`;
const commentUrl = (issue: number, id: number) =>
  `${issueUrl(issue)}#issuecomment-${id}`;

/** A ticketing system in memory with the GitHub tools the app calls; it pages issues by two so the cursor loop runs. */
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
  const comments: { id: number; issue: number; body: string }[] = [];
  const since: (string | undefined)[] = [];
  const fake = {
    issues,
    comments,
    since,
    connect,
    // The next comment fails before it is made; the next filing is made, then its response is lost.
    failNext: false,
    loseNext: false,
  };
  function serve() {
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
          fields: z.array(z.string()).optional(),
          state: z.enum(["OPEN", "CLOSED"]).optional(),
        },
      },
      async (args) => {
        since.push(args.since);
        const changed = issues
          .filter((i) => !args.state || i.state === args.state)
          .filter(
            (i) =>
              !args.since || new Date(i.updated_at) >= new Date(args.since),
          )
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
        const start = Number(args.after ?? 0);
        return json({
          issues: changed.slice(start, start + 2),
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
        if (fake.loseNext) {
          fake.loseNext = false;
          return failure("connection lost");
        }
        return json({ id: String(number), url: issueUrl(number) });
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
          return failure("down");
        }
        const id = comments.length + 1;
        comments.push({ id, issue: issue_number, body });
        return json({ id: String(id), url: commentUrl(issue_number, id) });
      },
    );
    server.registerTool(
      "issue_read",
      {
        inputSchema: {
          method: z.literal("get_comments"),
          owner: z.string(),
          repo: z.string(),
          issue_number: z.number(),
          page: z.number(),
          perPage: z.number(),
        },
      },
      async ({ issue_number }) =>
        json(
          comments
            .filter((c) => c.issue === issue_number)
            .map((c) => ({
              body: c.body,
              html_url: commentUrl(issue_number, c.id),
            })),
        ),
    );
    return server;
  }
  async function connect() {
    const [client, transport] = InMemoryTransport.createLinkedPair();
    await serve().connect(transport);
    return connectMcp(client);
  }
  return fake;
}

const github = fakeGitHub();
const tools = Object.fromEntries(
  githubTools(github.connect).map((t) => [t.name, t]),
);

test("pulls the issues that changed since the last sync, a page at a time", async () => {
  const mcp = await github.connect();
  expect(await pullTickets(mcp)).toEqual({
    pulled: 3,
    since: null,
    missed: 0,
    gone: 0,
  });
  expect(github.since).toEqual([undefined, undefined]);
  const pulledAt = await lastSync();

  github.issues[1].state = "CLOSED";
  github.issues[1].updated_at = "2026-10-09T00:00:00Z";
  // `since` is inclusive at GitHub, so the newest row of the last pull comes again.
  const second = await pullTickets(mcp);
  expect(second.pulled).toBe(2);
  expect(second.since?.toISOString()).toBe("2026-10-03T00:00:00.000Z");
  expect((await lastSync())!.getTime()).toBeGreaterThanOrEqual(
    pulledAt!.getTime(),
  );

  const tickets = await listTickets();
  expect(tickets.map((t) => [t.key, t.state])).toEqual([
    ["2", "closed"],
    ["3", "open"],
    ["1", "open"],
  ]);
  expect(tickets[2]).toMatchObject({
    id: "github#1",
    source: "github",
    assignee: "sam",
    team: "operations",
    url: issueUrl(1),
  });
  await mcp.close();
});

test("a full pull finds what the other paths missed and drops what the system no longer lists", async () => {
  const mcp = await github.connect();
  github.issues[0].title = "Badge printer jams again";
  github.issues[0].updated_at = "2026-10-10T00:00:00Z";
  github.issues.splice(2, 1);
  expect(await pullTickets(mcp, { full: true })).toMatchObject({
    pulled: 2,
    missed: 1,
    gone: 1,
  });
  expect((await listTickets()).map((t) => [t.key, t.title])).toEqual([
    ["1", "Badge printer jams again"],
    ["2", "Van 3 brake light"],
  ]);
  github.issues.push({
    number: 3,
    title: "Invoice 4471 unpaid",
    body: "",
    state: "OPEN",
    assignees: [],
    labels: ["finance"],
    updated_at: "2026-10-11T00:00:00Z",
  });
  await pullTickets(mcp);
  await mcp.close();
});

test("finds tickets in the synced copy", async () => {
  expect(await tools.find_ticket.run({ query: "printer" })).toBe(
    `#1 (open, sam, operations) Badge printer jams again ${issueUrl(1)}`,
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

  expect(await tools.file_ticket.run(input)).toBe(`Filed #4: ${issueUrl(4)}`);
  expect(github.issues[3].body).toBe(
    "Reported by reception.\n\nFiled by WorkBot (REQ-88).",
  );
  expect(await tools.file_ticket.run({ ...input, title: "Again" })).toBe(
    `Already filed as #4: ${issueUrl(4)}`,
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

test("a write that fails before it is made gives its key back", async () => {
  const input = { number: 1, text: "x", key: "REQ-91" };
  github.failNext = true;
  await expect(tools.comment_on_ticket.run(input)).rejects.toThrow("down");
  expect(await tools.comment_on_ticket.run(input)).toBe(
    `Commented on #1: ${commentUrl(1, 1)}`,
  );
});

test("a claim with no result is in flight for 5 minutes, then free", async () => {
  await query(
    `insert into filings (kind, key, created_at, claimed_at)
     values ('filing', 'REQ-92', now(), now()), ('filing', 'REQ-93', now() - interval '6 minutes', now() - interval '6 minutes')`,
  );
  expect(
    await tools.file_ticket.run({ title: "Dock door stuck", key: "REQ-92" }),
  ).toBe("Being filed now under the key REQ-92; ask again in a moment.");
  expect(
    await tools.file_ticket.run({ title: "Dock door stuck", key: "REQ-93" }),
  ).toBe(`Filed #6: ${issueUrl(6)}`);
});

test("a crashed filing that reached the system is found by its signature, however old", async () => {
  github.issues.push({
    number: 7,
    title: "Forklift charger",
    body: "Filed by WorkBot (REQ-94).",
    state: "OPEN",
    assignees: [],
    labels: [],
    updated_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  });
  await query(
    `insert into filings (kind, key, created_at, claimed_at)
     values ('filing', 'REQ-94', now() - interval '3 days', now() - interval '3 days')`,
  );
  expect(
    await tools.file_ticket.run({ title: "Forklift charger", key: "REQ-94" }),
  ).toBe(`Already filed as #7: ${issueUrl(7)}`);
  expect(github.issues).toHaveLength(7);
});

test("a write whose response was lost is found by its signature, not made again", async () => {
  github.loseNext = true;
  expect(
    await tools.file_ticket.run({ title: "Pallet jack", key: "REQ-95" }),
  ).toBe(`Filed #8: ${issueUrl(8)}`);
  expect(github.issues).toHaveLength(8);
});

test("comments on a ticket once per key, a key the filing also used", async () => {
  const input = { number: 1, text: "Toner ordered.", key: "REQ-88" };
  expect(await tools.comment_on_ticket.run(input)).toBe(
    `Commented on #1: ${commentUrl(1, 2)}`,
  );
  expect(await tools.comment_on_ticket.run(input)).toBe(
    `Already commented on #1: ${commentUrl(1, 2)}`,
  );
  expect(github.comments.map((c) => c.body)).toEqual([
    "x\n\nComment by WorkBot (REQ-91).",
    "Toner ordered.\n\nComment by WorkBot (REQ-88).",
  ]);
});

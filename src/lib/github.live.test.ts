import { afterAll, expect, test } from "vitest";
import { githubConnect, githubTools } from "./github";
import { withMcp } from "./mcp";
import { pullTickets, repository } from "./tickets";
import { listTickets } from "./unified";

// Against GitHub's own MCP server and the repository in .env.local: the sync,
// the find, a filing and a comment made once each, and the issue closed after.
const tools = Object.fromEntries(githubTools().map((t) => [t.name, t]));
const key = `live-${Date.now()}`;
let filed: number | undefined;

afterAll(async () => {
  if (!filed) return;
  const { owner, repo } = repository();
  await withMcp(githubConnect, (mcp) =>
    mcp.call("issue_write", {
      method: "update",
      owner,
      repo,
      issue_number: filed,
      state: "closed",
    }),
  );
});

test("pulls the repository's issues into the tickets table", async () => {
  const { pulled } = await withMcp(githubConnect, pullTickets);
  expect(pulled).toBeGreaterThan(0);
  const tickets = await listTickets();
  expect(tickets[0].url).toContain("github.com");
  expect(
    await tools.find_ticket.run({ query: tickets[0].title.slice(0, 12) }),
  ).toContain(`#${tickets[0].key}`);
});

test("files a ticket and comments on it once per key", async () => {
  const input = {
    title: "Ticket tools live test",
    body: "Filed and closed by the live suite.",
    key,
  };
  const first = await tools.file_ticket.run(input);
  expect(first).toMatch(/^Filed #\d+: https:\/\/github\.com\//);
  filed = Number(first.match(/#(\d+)/)![1]);
  expect(await tools.file_ticket.run(input)).toBe(
    `Already filed as #${filed}: ${first.split(": ")[1]}`,
  );
  const comment = { number: filed, text: "Checked.", key: `${key}-comment` };
  expect(await tools.comment_on_ticket.run(comment)).toMatch(
    `Commented on #${filed}`,
  );
  expect(await tools.comment_on_ticket.run(comment)).toMatch(
    `Already commented on #${filed}`,
  );
});

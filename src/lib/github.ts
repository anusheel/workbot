import { z } from "zod";
import { config } from "./config";
import { type Mcp, connectMcp, remote, withMcp } from "./mcp";
import {
  type Filing,
  type Ticket,
  filingOf,
  findTickets,
  once,
  repository,
} from "./tickets";
import { type Tool, tool } from "./tool";

/** GitHub's own MCP server, which keeps the tool surface; the token and the issues toolset are ours. */
export const githubMcp = "https://api.githubcopilot.com/mcp/";

export const githubEnabled = () =>
  Boolean(config.github.token && config.github.repo);

export const githubConnect = () =>
  connectMcp(
    remote(githubMcp, config.github.token ?? "", {
      "X-MCP-Toolsets": "issues",
    }),
  );

/** What the server returns for a write: the id and the page of what it wrote. */
const written = (text: string) =>
  JSON.parse(text) as { id: string; url: string };

const line = (t: Ticket) =>
  `#${t.number} (${t.state}${t.assignee ? `, ${t.assignee}` : ""}) ${t.title} ${t.url}`;

/** What a repeated key gets: the first write, or word that it is still being made. */
const already = (did: string, f: Filing) =>
  f.url
    ? `Already ${did} #${f.number}: ${f.url}`
    : `Being ${did} now under the key ${f.key}; ask again in a moment.`;

/**
 * The tickets as 3 product-level tools over GitHub's 46: a find that reads
 * the synced copy, a filing and a comment that write through the server once
 * per key, each with a dry run. The descriptions are the documentation the
 * model gets: inputs, side effects, what not to do.
 */
export function githubTools(
  connect: () => Promise<Mcp> = githubConnect,
): Tool[] {
  const { owner, repo, slug } = repository();
  const key = z
    .string()
    .min(1)
    .max(120)
    .describe(
      "what this is about, so it is done once: a request id, an invoice number",
    );
  const dryRun = z.boolean().default(false);
  return [
    tool({
      name: "find_ticket",
      description:
        "Finds tickets, the issues of the ticketing repository as synced every 15 minutes, by words in their title or body: up to 5, newest change first, each with number, state, assignee, title and link. Call it before filing a ticket, to find one that exists. Reads nothing from the network.",
      input: z.object({ query: z.string().min(2).max(200) }),
      run: async ({ query }) => {
        const found = await findTickets(query);
        return found.length
          ? found.map(line).join("\n")
          : `No ticket matches "${query}".`;
      },
    }),
    tool({
      name: "file_ticket",
      description:
        "Files a ticket: an issue in the ticketing repository, visible to everyone with access to it. The key names what the ticket is about, and a second call with the same key returns the ticket filed the first time rather than filing another. With dry_run, describes the ticket it would file and files nothing. Not for a question, which you answer; call find_ticket first.",
      input: z.object({
        title: z.string().min(3).max(120),
        body: z.string().max(5000).default(""),
        key,
        dry_run: dryRun,
      }),
      run: async ({ title, body, key, dry_run }) => {
        const filed = await filingOf(key);
        if (filed) return already("filed as", filed);
        if (dry_run)
          return `Would file "${title}" in ${slug} under the key ${key}. Nothing filed.`;
        const { filing, made } = await once(key, async () => {
          const { url } = written(
            await withMcp(connect, (mcp) =>
              mcp.call("issue_write", {
                method: "create",
                owner,
                repo,
                title,
                body: `${body}\n\nFiled by WorkBot (${key}).`.trim(),
              }),
            ),
          );
          return { number: Number(url.split("/").pop()), url };
        });
        return made
          ? `Filed #${filing.number}: ${filing.url}`
          : already("filed as", filing);
      },
    }),
    tool({
      name: "comment_on_ticket",
      description:
        "Adds a comment to a ticket by its number, visible to everyone with access to the repository, once per key: a second call with the same key returns the comment made the first time. With dry_run, shows the comment it would add and adds nothing. Nothing personal about anyone goes in a comment.",
      input: z.object({
        number: z.number().int().positive(),
        text: z.string().min(1).max(5000),
        key,
        dry_run: dryRun,
      }),
      run: async ({ number, text, key, dry_run }) => {
        const commented = await filingOf(key);
        if (commented) return already("commented on", commented);
        if (dry_run)
          return `Would comment on #${number}: "${text}". Nothing added.`;
        const { filing, made } = await once(key, async () => {
          const { url } = written(
            await withMcp(connect, (mcp) =>
              mcp.call("add_issue_comment", {
                owner,
                repo,
                issue_number: number,
                body: text,
              }),
            ),
          );
          return { number, url };
        });
        return made
          ? `Commented on #${number}: ${filing.url}`
          : already("commented on", filing);
      },
    }),
  ];
}

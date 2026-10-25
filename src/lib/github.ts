import { z } from "zod";
import { config } from "./config";
import { type Mcp, connectMcp, remote, withMcp } from "./mcp";
import {
  type Filing,
  type Kind,
  type Ticket,
  filingOf,
  findTickets,
  issuePages,
  issueUrl,
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

/** The line every write ends with, so it can be found in the system by its key. */
const signature = (kind: Kind, key: string) =>
  `${kind === "filing" ? "Filed" : "Comment"} by WorkBot (${key}).`;
const signed = (kind: Kind, text: string, key: string) =>
  `${text}\n\n${signature(kind, key)}`.trim();

const line = (t: Ticket) =>
  `#${t.number} (${t.state}${t.assignee ? `, ${t.assignee}` : ""}) ${t.title} ${t.url}`;

/** What a repeated key gets: the first write, or word that it is still being made. */
const already = (done: string, doing: string, f: Filing) =>
  f.url
    ? `Already ${done} #${f.number}: ${f.url}`
    : `Being ${doing} now under the key ${f.key}; ask again in a moment.`;

const day = 86_400_000;

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

  /** The issue a filing under the key made, if a crashed or failed one did: by its signature, among the day's changes. */
  const filedUnder = (key: string) =>
    withMcp(connect, async (mcp) => {
      const since = new Date(Date.now() - day).toISOString();
      for await (const issues of issuePages(mcp, {
        since,
        fields: ["number", "body"],
      })) {
        const issue = issues.find((i) =>
          i.body?.endsWith(signature("filing", key)),
        );
        if (issue)
          return { number: issue.number, url: issueUrl(slug, issue.number) };
      }
      return undefined;
    });

  /** The comment under the key on an issue, if one was made: by its signature, over every page of comments. */
  const commentedUnder = (key: string, number: number) =>
    withMcp(connect, async (mcp) => {
      for (let page = 1; ; page++) {
        const comments = JSON.parse(
          await mcp.call("issue_read", {
            method: "get_comments",
            owner,
            repo,
            issue_number: number,
            page,
            perPage: 100,
          }),
        ) as { body: string; html_url: string }[];
        const comment = comments.find((c) =>
          c.body.endsWith(signature("comment", key)),
        );
        if (comment) return { number, url: comment.html_url };
        if (comments.length < 100) return undefined;
      }
    });

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
        const filed = await filingOf("filing", key);
        if (filed) return already("filed as", "filed", filed);
        if (dry_run)
          return `Would file "${title}" in ${slug} under the key ${key}. Nothing filed.`;
        const { filing, made } = await once(
          "filing",
          key,
          async () => {
            const { url } = written(
              await withMcp(connect, (mcp) =>
                mcp.call("issue_write", {
                  method: "create",
                  owner,
                  repo,
                  title,
                  body: signed("filing", body, key),
                }),
              ),
            );
            return { number: Number(url.split("/").pop()), url };
          },
          () => filedUnder(key),
        );
        return made
          ? `Filed #${filing.number}: ${filing.url}`
          : already("filed as", "filed", filing);
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
        const commented = await filingOf("comment", key);
        if (commented)
          return already("commented on", "commented on", commented);
        if (dry_run)
          return `Would comment on #${number}: "${text}". Nothing added.`;
        const { filing, made } = await once(
          "comment",
          key,
          async () => {
            const { url } = written(
              await withMcp(connect, (mcp) =>
                mcp.call("add_issue_comment", {
                  owner,
                  repo,
                  issue_number: number,
                  body: signed("comment", text, key),
                }),
              ),
            );
            return { number, url };
          },
          () => commentedUnder(key, number),
        );
        return made
          ? `Commented on #${number}: ${filing.url}`
          : already("commented on", "commented on", filing);
      },
    }),
  ];
}

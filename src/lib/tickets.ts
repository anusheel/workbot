import { config } from "./config";
import { query } from "./db";
import type { Mcp } from "./mcp";

/** One ticket shape whatever the system behind it: GitHub's issues today, a help desk's tomorrow. */
export type Ticket = {
  id: string;
  source: string;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  assignee: string | null;
  labels: string[];
  url: string;
  updatedAt: Date;
  syncedAt: Date;
};

const columns = `id, source, number, title, body, state, assignee, labels, url, updated_at as "updatedAt", synced_at as "syncedAt"`;

/** The ticketing repository as owner and name, from the configuration. */
export function repository() {
  const [owner, repo] = (config.github.repo ?? "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO is owner/name");
  return { owner, repo, slug: `${owner}/${repo}` };
}

type Issue = {
  number: number;
  title: string;
  body?: string;
  state: string;
  assignees?: { login: string }[];
  labels?: string[];
  updated_at: string;
};

export const issueUrl = (slug: string, number: number) =>
  `https://github.com/${slug}/issues/${number}`;

/**
 * Pulls the issues that changed since the last sync, a page at a time, into
 * the tickets table: the one shape the tools read, kept fresh here in
 * Postgres rather than fetched on every question.
 */
export async function pullTickets(
  mcp: Mcp,
): Promise<{ pulled: number; since: Date | null }> {
  const { owner, repo, slug } = repository();
  const [{ since }] = await query<{ since: Date | null }>(
    `select max(updated_at) as since from tickets where source = $1`,
    [slug],
  );
  let after: string | undefined;
  let pulled = 0;
  // No state filter: closed issues come too, and a closure is a change.
  do {
    const page = JSON.parse(
      await mcp.call("list_issues", {
        owner,
        repo,
        perPage: 100,
        orderBy: "UPDATED_AT",
        direction: "ASC",
        ...(since && { since: since.toISOString() }),
        ...(after && { after }),
      }),
    ) as {
      issues: Issue[];
      pageInfo?: { hasNextPage: boolean; endCursor: string };
    };
    for (const issue of page.issues) {
      await query(
        `insert into tickets (id, source, number, title, body, state, assignee, labels, url, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set title = excluded.title, body = excluded.body, state = excluded.state,
           assignee = excluded.assignee, labels = excluded.labels, updated_at = excluded.updated_at, synced_at = now()`,
        [
          `${slug}#${issue.number}`,
          slug,
          issue.number,
          issue.title,
          issue.body ?? "",
          issue.state.toLowerCase(),
          issue.assignees?.[0]?.login ?? null,
          issue.labels ?? [],
          issueUrl(slug, issue.number),
          issue.updated_at,
        ],
      );
      pulled++;
    }
    after = page.pageInfo?.hasNextPage ? page.pageInfo.endCursor : undefined;
  } while (after);
  return { pulled, since };
}

/** The tickets, newest change first. */
export const listTickets = (limit = 50) =>
  query<Ticket>(
    `select ${columns} from tickets order by updated_at desc limit $1`,
    [limit],
  );

/** Tickets whose title or body holds the words, newest change first. */
export const findTickets = (words: string, limit = 5) =>
  query<Ticket>(
    `select ${columns} from tickets where title ilike $1 or body ilike $1 order by updated_at desc limit $2`,
    [`%${words}%`, limit],
  );

/** When the tickets were last pulled; null before the first sync. */
export async function lastSync(): Promise<Date | null> {
  const [row] = await query<{ at: Date | null }>(
    `select max(synced_at) as at from tickets`,
  );
  return row.at;
}

/** A write made through the ticketing system, remembered by its key; the number and link are null while it is in flight. */
export type Filing = { key: string; number: number | null; url: string | null };

/** How long a claim with no result counts as a write in flight rather than a crashed one. */
const inFlight = "5 minutes";

/** The write made under a key, or the claim of one in flight; a crashed claim is invisible here and free below. */
export async function filingOf(key: string): Promise<Filing | undefined> {
  const [row] = await query<Filing>(
    `select key, number, url from filings
     where key = $1 and (url is not null or created_at > now() - interval '${inFlight}')`,
    [key],
  );
  return row;
}

/**
 * Makes a write once per key. The key is claimed before the write, so a
 * second call with the same key, at the same time or later, gets the first
 * result and makes nothing; a write that fails gives its key back, and a
 * claim with no result after 5 minutes is a crashed write, free to retry.
 */
export async function once(
  key: string,
  write: () => Promise<{ number: number; url: string }>,
): Promise<{ filing: Filing; made: boolean }> {
  const [claimed] = await query(
    `insert into filings (key) values ($1)
     on conflict (key) do update set created_at = now()
       where filings.url is null and filings.created_at < now() - interval '${inFlight}'
     returning key`,
    [key],
  );
  if (!claimed) return { filing: (await filingOf(key))!, made: false };
  try {
    const made = await write();
    await query(`update filings set number = $2, url = $3 where key = $1`, [
      key,
      made.number,
      made.url,
    ]);
    return { filing: { key, ...made }, made: true };
  } catch (err) {
    await query(`delete from filings where key = $1`, [key]);
    throw err;
  }
}

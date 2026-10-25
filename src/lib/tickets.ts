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
};

const columns = `id, source, number, title, body, state, assignee, labels, url, updated_at as "updatedAt"`;

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

/** The issues changed since a time, oldest change first, a page of up to 100 at a time. */
export async function* issuePages(
  mcp: Mcp,
  args: { since?: string; fields?: string[] } = {},
): AsyncGenerator<Issue[]> {
  const { owner, repo } = repository();
  let after: string | undefined;
  do {
    const page = JSON.parse(
      await mcp.call("list_issues", {
        owner,
        repo,
        perPage: 100,
        orderBy: "UPDATED_AT",
        direction: "ASC",
        ...args,
        ...(after && { after }),
      }),
    ) as {
      issues: Issue[];
      pageInfo?: { hasNextPage: boolean; endCursor: string };
    };
    yield page.issues;
    after = page.pageInfo?.hasNextPage ? page.pageInfo.endCursor : undefined;
  } while (after);
}

/**
 * Pulls the issues that changed since the last sync into the tickets table:
 * the one shape the tools read, kept fresh here in Postgres rather than
 * fetched on every question. No state filter: closed issues come too, and a
 * closure is a change.
 */
export async function pullTickets(
  mcp: Mcp,
): Promise<{ pulled: number; since: Date | null }> {
  const { slug } = repository();
  const [{ since }] = await query<{ since: Date | null }>(
    `select max(updated_at) as since from tickets where source = $1`,
    [slug],
  );
  let pulled = 0;
  for await (const issues of issuePages(mcp, {
    since: since?.toISOString(),
  })) {
    for (const issue of issues) {
      await query(
        `insert into tickets (id, source, number, title, body, state, assignee, labels, url, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do update set title = excluded.title, body = excluded.body, state = excluded.state,
           assignee = excluded.assignee, labels = excluded.labels, updated_at = excluded.updated_at`,
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
  }
  await query(
    `insert into syncs (source, pulled_at, pulled) values ($1, now(), $2)
     on conflict (source) do update set pulled_at = now(), pulled = excluded.pulled`,
    [slug, pulled],
  );
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

/** When the tickets were last pulled, changed or not; null before the first sync. */
export async function lastSync(): Promise<Date | null> {
  const [row] = await query<{ at: Date | null }>(
    `select max(pulled_at) as at from syncs`,
  );
  return row.at;
}

/** A write made through the ticketing system, remembered by its kind and key; the number and link are null while it is in flight. */
export type Filing = { key: string; number: number | null; url: string | null };
export type Kind = "filing" | "comment";
type Made = { number: number; url: string };

/** How long a claim with no result counts as a write in flight rather than a crashed one. */
const inFlight = "5 minutes";

/** The write made under a key, or the claim of one in flight; a crashed claim is invisible here and free below. */
export async function filingOf(
  kind: Kind,
  key: string,
): Promise<Filing | undefined> {
  const [row] = await query<Filing>(
    `select key, number, url from filings
     where kind = $1 and key = $2 and (url is not null or created_at > now() - interval '${inFlight}')`,
    [kind, key],
  );
  return row;
}

const record = (kind: Kind, key: string, made: Made) =>
  query(
    `update filings set number = $3, url = $4 where kind = $1 and key = $2`,
    [kind, key, made.number, made.url],
  );

/**
 * Makes a write once per key. The key is claimed before the write, so a
 * second call with the same key, at the same time or later, gets the first
 * result and makes nothing. A claim with no result after 5 minutes is a
 * crashed write, and a write that throws may have reached the system before
 * it failed: both look there first, with `find`, and write only when
 * nothing was made under the key.
 */
export async function once(
  kind: Kind,
  key: string,
  write: () => Promise<Made>,
  find: () => Promise<Made | undefined>,
): Promise<{ filing: Filing; made: boolean }> {
  const [fresh] = await query(
    `insert into filings (kind, key) values ($1, $2) on conflict (kind, key) do nothing returning key`,
    [kind, key],
  );
  if (!fresh) {
    const current = await filingOf(kind, key);
    if (current) return { filing: current, made: false };
    const [taken] = await query(
      `update filings set created_at = now()
       where kind = $1 and key = $2 and url is null and created_at < now() - interval '${inFlight}'
       returning key`,
      [kind, key],
    );
    if (!taken) return { filing: (await filingOf(kind, key))!, made: false };
    const prior = await find();
    if (prior) {
      await record(kind, key, prior);
      return { filing: { key, ...prior }, made: false };
    }
  }
  try {
    const made = await write();
    await record(kind, key, made);
    return { filing: { key, ...made }, made: true };
  } catch (err) {
    const made = await find().catch(() => undefined);
    if (made) {
      await record(kind, key, made);
      return { filing: { key, ...made }, made: true };
    }
    await query(`delete from filings where kind = $1 and key = $2`, [
      kind,
      key,
    ]);
    throw err;
  }
}

import { config } from "./config";
import { query } from "./db";
import type { Mcp } from "./mcp";
import {
  type Issue,
  dropTicketsExcept,
  fromIssue,
  logSync,
  ticketUpdatedAt,
  upsertTicket,
} from "./unified";

/** The ticketing repository as owner and name, from the configuration. */
export function repository() {
  const [owner, repo] = (config.github.repo ?? "").split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPO is owner/name");
  return { owner, repo, slug: `${owner}/${repo}` };
}

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
 * closure is a change. A full pull is the nightly reconciliation: it reads
 * every issue, counts the rows the webhook and the pulls had missed, and
 * drops the ones the system no longer lists.
 */
export async function pullTickets(
  mcp: Mcp,
  { full = false } = {},
): Promise<{
  pulled: number;
  since: Date | null;
  missed: number;
  gone: number;
}> {
  const { slug } = repository();
  const [{ since }] = await query<{ since: Date | null }>(
    `select max(updated_at) as since from tickets where source = 'github'`,
  );
  const seen = new Set<string>();
  let pulled = 0;
  let missed = 0;
  for await (const issues of issuePages(mcp, {
    since: full ? undefined : since?.toISOString(),
  })) {
    for (const issue of issues) {
      const input = fromIssue(slug, issue);
      const lag = Date.now() - input.updatedAt.getTime();
      const before = full ? await ticketUpdatedAt("github", input.key) : null;
      await upsertTicket(input);
      seen.add(input.key);
      pulled++;
      // The backfill is not a measure of the path; a pull since a time is.
      if (!full && since) await logSync("github", input.key, "pull", lag);
      else if (full && since && (!before || before < input.updatedAt)) {
        missed++;
        await logSync("github", input.key, "missed", lag);
      }
    }
  }
  const gone = full ? await dropTicketsExcept("github", seen) : [];
  for (const key of gone) await logSync("github", key, "gone");
  await query(
    `insert into syncs (source, pulled_at, pulled) values ($1, now(), $2)
     on conflict (source) do update set pulled_at = now(), pulled = excluded.pulled`,
    [slug, pulled],
  );
  return { pulled, since, missed, gone: gone.length };
}

/** A write made through the ticketing system, remembered by its kind and key; the number and link are null while it is in flight. */
export type Filing = { key: string; number: number | null; url: string | null };
export type Kind = "filing" | "comment";
type Made = { number: number; url: string };

/** How long a claim with no result counts as a write in flight rather than a crashed one: longer than any call, which the client cuts off after a minute. */
const inFlight = "5 minutes";

/** The write made under a key, or the claim of one in flight; a crashed claim is invisible here and free below. */
export async function filingOf(
  kind: Kind,
  key: string,
): Promise<Filing | undefined> {
  const [row] = await query<Filing>(
    `select key, number, url from filings
     where kind = $1 and key = $2 and (url is not null or claimed_at > now() - interval '${inFlight}')`,
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
 * it failed: both look there first, with `find` from the time of the first
 * claim, and write only when nothing was made under the key.
 */
export async function once(
  kind: Kind,
  key: string,
  write: () => Promise<Made>,
  find: (since: Date) => Promise<Made | undefined>,
): Promise<{ filing: Filing; made: boolean }> {
  type Claim = { since: Date };
  const [fresh] = await query<Claim>(
    `insert into filings (kind, key) values ($1, $2) on conflict (kind, key) do nothing returning created_at as since`,
    [kind, key],
  );
  let { since } = fresh ?? {};
  if (!since) {
    const current = await filingOf(kind, key);
    if (current) return { filing: current, made: false };
    const [taken] = await query<Claim>(
      `update filings set claimed_at = now()
       where kind = $1 and key = $2 and url is null and claimed_at < now() - interval '${inFlight}'
       returning created_at as since`,
      [kind, key],
    );
    if (!taken) return { filing: (await filingOf(kind, key))!, made: false };
    since = taken.since;
    const prior = await find(since);
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
    const made = await find(since).catch(() => undefined);
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

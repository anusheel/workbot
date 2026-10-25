import { query } from "./db";
import type { DocumentRecord } from "./documents";
import { WorkRequest } from "./requests";
import { type Applied, applyRules, normalizePhone } from "./rules";

/** One ticket wherever it lives: a GitHub issue, a WorkBot request. */
export type Ticket = {
  id: string;
  source: string;
  key: string;
  title: string;
  body: string;
  state: "open" | "closed";
  assignee: string | null;
  labels: string[];
  team: string | null;
  url: string;
  updatedAt: Date;
  applied: Applied[];
};

/** One contact wherever it was seen: a document's sender, a GitHub login. */
export type Contact = {
  id: string;
  source: string;
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  url: string | null;
  updatedAt: Date;
  applied: Applied[];
};

/** What a provider's record becomes before the rules: the shape, plus the record itself in raw. */
export type TicketInput = Omit<Ticket, "id" | "applied"> & { raw: unknown };
export type ContactInput = Omit<Contact, "id" | "applied"> & { raw: unknown };

export const issueUrl = (slug: string, number: number) =>
  `https://github.com/${slug}/issues/${number}`;

/** A GitHub issue as the server lists it or as a webhook delivers it: labels as names or objects, the state in either case. */
export type Issue = {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  user?: { login: string };
  assignees?: { login: string }[];
  labels?: (string | { name: string })[];
  html_url?: string;
  updated_at: string;
};

export const fromIssue = (slug: string, issue: Issue): TicketInput => ({
  source: "github",
  key: String(issue.number),
  title: issue.title,
  body: issue.body ?? "",
  state: issue.state.toLowerCase() === "closed" ? "closed" : "open",
  assignee: issue.assignees?.[0]?.login ?? null,
  labels: (issue.labels ?? []).map((l) => (typeof l === "string" ? l : l.name)),
  team: null,
  url: issue.html_url ?? issueUrl(slug, issue.number),
  updatedAt: new Date(issue.updated_at),
  raw: issue,
});

export const fromRequest = (request: WorkRequest): TicketInput => ({
  source: "workbot",
  key: request.id,
  title: request.title,
  body: request.body,
  state: request.status === "done" ? "closed" : "open",
  assignee: null,
  labels: [request.priority],
  team: request.team,
  url: `/requests/${request.id}`,
  updatedAt: request.createdAt,
  raw: request,
});

const mailbox = /^(.*?)\s*<([^>]+)>$/;
const contact = (
  source: string,
  name: string,
  email: string | null,
  phone: string | null,
  company: string | null,
  url: string | null,
  updatedAt: Date,
  raw: unknown,
): ContactInput | undefined =>
  name.trim()
    ? {
        source,
        key: email?.trim().toLowerCase() || `${source}:${name.trim()}`,
        name: name.trim(),
        email: email?.trim().toLowerCase() || null,
        phone: phone?.trim() || null,
        company: company?.trim() || null,
        url,
        updatedAt,
        raw,
      }
    : undefined;

/** The sender a document names: the vendor of an invoice, the From of an email, the writer of a letter. */
export function fromDocument(doc: DocumentRecord): ContactInput | undefined {
  const at = doc.createdAt;
  const extracted = { type: doc.type, data: doc.data } as
    | {
        type: "invoice";
        data: {
          vendor: string;
          vendorEmail: string | null;
          vendorPhone: string | null;
        };
      }
    | { type: "email"; data: { from: string } }
    | {
        type: "letter";
        data: { from: string; fields: { name: string; value: string }[] };
      }
    | { type: "job"; data: unknown };
  switch (extracted.type) {
    case "invoice": {
      const { vendor, vendorEmail, vendorPhone } = extracted.data;
      return contact(
        "document",
        vendor,
        vendorEmail,
        vendorPhone,
        vendor,
        null,
        at,
        doc.data,
      );
    }
    case "email": {
      const { from } = extracted.data;
      const match = from.match(mailbox);
      const email = match?.[2] ?? (from.includes("@") ? from : null);
      return contact(
        "document",
        match?.[1] || from,
        email,
        null,
        null,
        null,
        at,
        doc.data,
      );
    }
    case "letter": {
      const { from, fields } = extracted.data;
      const field = (pattern: RegExp) =>
        fields.find((f) => pattern.test(f.name))?.value ?? null;
      return contact(
        "document",
        from,
        field(/mail/i),
        field(/phone|tel/i),
        null,
        null,
        at,
        doc.data,
      );
    }
    case "job":
      return undefined;
  }
}

export const fromLogin = (login: string, updatedAt: Date): ContactInput => ({
  source: "github",
  key: login,
  name: login,
  email: null,
  phone: null,
  company: null,
  url: `https://github.com/${login}`,
  updatedAt,
  raw: { login },
});

const ticketColumns = `id, source, key, title, body, state, assignee, labels, team, url, applied, updated_at as "updatedAt"`;
const contactColumns = `id, source, key, name, email, phone, company, url, applied, updated_at as "updatedAt"`;

/**
 * Stores a ticket as the rules leave it, with what they changed. A version
 * older than the row's is dropped, so a delivery that arrives late never
 * undoes a pull, and the same version twice changes nothing.
 */
export async function upsertTicket(input: TicketInput): Promise<Ticket> {
  // The rules read the title: a body is long and says many things, a title says what the ticket is.
  const { record, applied } = applyRules("ticket", {
    ...input,
    text: input.title,
  });
  const id = `${input.source}#${input.key}`;
  const [row] = await query<Ticket>(
    `insert into tickets (id, source, key, title, body, state, assignee, labels, team, url, raw, applied, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     on conflict (tenant, id) do update set title = excluded.title, body = excluded.body, state = excluded.state,
       assignee = excluded.assignee, labels = excluded.labels, team = excluded.team, url = excluded.url,
       raw = excluded.raw, applied = excluded.applied, updated_at = excluded.updated_at
     where excluded.updated_at >= tickets.updated_at
     returning ${ticketColumns}`,
    [
      id,
      input.source,
      input.key,
      input.title,
      input.body,
      input.state,
      input.assignee,
      input.labels,
      record.team ?? null,
      input.url,
      input.raw,
      applied,
      input.updatedAt,
    ],
  );
  if (row) return row;
  const [kept] = await query<Ticket>(
    `select ${ticketColumns} from tickets where id = $1`,
    [id],
  );
  return kept;
}

/** Stores a contact as the rules leave it; a contact seen again keeps what it already knew. */
export async function upsertContact(input: ContactInput): Promise<Contact> {
  const { record, applied } = applyRules("contact", { ...input });
  const [row] = await query<Contact>(
    `insert into contacts (id, source, key, name, email, phone, company, url, raw, applied, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     on conflict (tenant, id) do update set name = excluded.name,
       email = coalesce(excluded.email, contacts.email), phone = coalesce(excluded.phone, contacts.phone),
       company = coalesce(excluded.company, contacts.company), url = coalesce(excluded.url, contacts.url),
       raw = excluded.raw, applied = excluded.applied, updated_at = greatest(excluded.updated_at, contacts.updated_at)
     returning ${contactColumns}`,
    [
      `${input.source}:${input.key}`,
      input.source,
      input.key,
      input.name,
      input.email,
      record.phone ?? null,
      record.company ?? null,
      input.url,
      input.raw,
      applied,
      input.updatedAt,
    ],
  );
  return row;
}

/** When a ticket's copy last changed; undefined when the copy has none. */
export async function ticketUpdatedAt(source: string, key: string) {
  const [row] = await query<{ updatedAt: Date }>(
    `select updated_at as "updatedAt" from tickets where id = $1`,
    [`${source}#${key}`],
  );
  return row?.updatedAt;
}

/** Drops one ticket, which the system says is gone. */
export const dropTicket = (source: string, key: string) =>
  query(`delete from tickets where id = $1`, [`${source}#${key}`]);

/** Drops a source's tickets not in the set, the ones the system no longer lists, and returns their keys. */
export async function dropTicketsExcept(source: string, keys: Set<string>) {
  const rows = await query<{ key: string }>(
    `delete from tickets where source = $1 and not (key = any($2::text[])) returning key`,
    [source, [...keys]],
  );
  return rows.map((r) => r.key);
}

export const listTickets = (limit = 50) =>
  query<Ticket>(
    `select ${ticketColumns} from tickets order by updated_at desc limit $1`,
    [limit],
  );

/** Tickets whose title or body holds the words, newest change first. */
export const findTickets = (words: string, limit = 5) =>
  query<Ticket>(
    `select ${ticketColumns} from tickets where title ilike $1 or body ilike $1 order by updated_at desc limit $2`,
    [`%${words}%`, limit],
  );

export const listContacts = (limit = 50) =>
  query<Contact>(
    `select ${contactColumns} from contacts order by updated_at desc limit $1`,
    [limit],
  );

/** Contacts by words in their name, email or company, or by a phone number in any written form. */
export const findContacts = (words: string, limit = 5) =>
  query<Contact>(
    `select ${contactColumns} from contacts
     where name ilike $1 or email ilike $1 or company ilike $1 or phone = $2
     order by updated_at desc limit $3`,
    [`%${words}%`, normalizePhone(words), limit],
  );

/** Every request as a ticket under WorkBot's own source; they live in this database, so the sync is a mapping. */
export async function syncRequests(): Promise<number> {
  const requests = WorkRequest.array().parse(
    await query(
      `select id, title, body, team, priority, status, created_at as "createdAt" from requests order by created_at`,
    ),
  );
  for (const request of requests) await upsertTicket(fromRequest(request));
  return requests.length;
}

/** Every sender the documents name and every login the tickets carry, as contacts. */
export async function syncContacts(): Promise<number> {
  const documents = await query<DocumentRecord>(
    `select id, request_id as "requestId", type, name, data, confidence, review, applied, created_at as "createdAt"
     from documents order by created_at`,
  );
  let count = 0;
  for (const document of documents) {
    const input = fromDocument(document);
    if (!input) continue;
    await upsertContact(input);
    count++;
  }
  const logins = await query<{ login: string; at: Date }>(
    `select distinct on (login) login, updated_at as at from (
       select raw->'user'->>'login' as login, updated_at from tickets where source = 'github'
       union all select assignee, updated_at from tickets where source = 'github'
     ) seen where login is not null order by login, updated_at desc`,
  );
  for (const { login, at } of logins) {
    await upsertContact(fromLogin(login, at));
    count++;
  }
  return count;
}

/** What a sync path did for one ticket: how far behind the copy was, or what reconciliation found. */
export const logSync = (
  source: string,
  key: string,
  path: "webhook" | "pull" | "missed" | "gone",
  lagMs = 0,
) =>
  query(
    `insert into sync_log (source, key, path, lag_s) values ($1, $2, $3, $4)`,
    [source, key, path, Math.max(0, Math.round(lagMs / 1000))],
  );

export type SyncSummary = {
  medianLagS: { webhook: number | null; pull: number | null };
  missed: number;
  gone: number;
};

/** The last day of syncing: how far behind each path left the copy, and what reconciliation found. */
export async function syncSummary(): Promise<SyncSummary> {
  const rows = await query<{
    path: string;
    median: number | null;
    count: number;
  }>(
    `select path, percentile_cont(0.5) within group (order by lag_s)::int as median, count(*)::int as count
     from sync_log where at > now() - interval '1 day' group by path`,
  );
  const by = (path: string) => rows.find((r) => r.path === path);
  return {
    medianLagS: {
      webhook: by("webhook")?.median ?? null,
      pull: by("pull")?.median ?? null,
    },
    missed: by("missed")?.count ?? 0,
    gone: by("gone")?.count ?? 0,
  };
}

/** How many of each the one shape holds. */
export async function counts(): Promise<{ tickets: number; contacts: number }> {
  const [row] = await query<{ tickets: number; contacts: number }>(
    `select (select count(*) from tickets)::int as tickets, (select count(*) from contacts)::int as contacts`,
  );
  return row;
}

/** When the tickets were last pulled, changed or not; null before the first sync. */
export async function lastSync(): Promise<Date | null> {
  const [row] = await query<{ at: Date | null }>(
    `select max(pulled_at) as at from syncs`,
  );
  return row.at;
}

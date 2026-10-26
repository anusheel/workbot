// The schema as idempotent statements, applied in order at startup. Append
// to change it; never edit an earlier statement.
import { entityTables } from "./entities/tables";

const tables = [
  `create extension if not exists vector`,
  `create table if not exists requests (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null default '',
    team text not null,
    priority text not null default 'normal',
    status text not null default 'open',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists notes (
    id uuid primary key default gen_random_uuid(),
    text text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists memories (
    id uuid primary key default gen_random_uuid(),
    visitor text not null,
    kind text not null,
    text text not null,
    created_at timestamptz not null default now(),
    unique (visitor, text)
  )`,
  `create table if not exists chunks (
    path text primary key,
    document text not null,
    title text not null,
    heading text not null,
    text text not null,
    tsv tsvector generated always as (to_tsvector('english', title || ' ' || heading || ' ' || text)) stored,
    embedding vector(1024)
  )`,
  `create index if not exists chunks_tsv on chunks using gin (tsv)`,
  `create table if not exists reports (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references requests(id) on delete cascade,
    report text not null,
    findings jsonb not null default '[]',
    dollars double precision not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists recordings (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references requests(id) on delete cascade,
    name text not null,
    seconds integer not null,
    scenes jsonb not null default '[]',
    summary text not null,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists documents (
    id uuid primary key default gen_random_uuid(),
    request_id uuid not null references requests(id) on delete cascade,
    type text not null,
    name text not null,
    data jsonb not null,
    confidence jsonb not null default '{}',
    review jsonb not null default '[]',
    created_at timestamptz not null default now()
  )`,
  `create table if not exists inbox (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    media_type text not null,
    bytes bytea not null,
    status text not null default 'received',
    type text,
    data jsonb,
    confidence jsonb,
    review jsonb not null default '[]',
    request_id uuid references requests(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  `create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    recipient text not null,
    message text not null,
    link text,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists traces (
    id uuid primary key default gen_random_uuid(),
    at timestamptz not null default now(),
    tenant text not null,
    name text not null,
    prompt text,
    model text not null,
    input integer not null default 0,
    output integer not null default 0,
    cached integer not null default 0,
    dollars double precision not null default 0,
    ms integer not null default 0,
    ok boolean not null default true,
    error text
  )`,
  `create index if not exists traces_at on traces (at)`,
  `create table if not exists prompts (
    name text not null,
    version integer not null,
    text text not null,
    note text not null default '',
    share integer not null default 0,
    created_at timestamptz not null default now(),
    primary key (name, version)
  )`,
  // The request a call belongs to, so a fallback is the next call of the same request.
  `alter table traces add column if not exists request text`,
  // Tickets synced from the ticketing system, as Day 27 shaped them.
  `create table if not exists tickets (
    id text primary key,
    source text not null,
    number integer not null,
    title text not null,
    body text not null default '',
    state text not null,
    assignee text,
    labels jsonb not null default '[]',
    url text not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists tickets_updated on tickets (source, updated_at)`,
  // One shape for tickets and contacts wherever they live, with the provider's record in raw and the rules that fired in applied.
  // A ticket is keyed as text under its source now, not by issue number under the repository's name.
  `alter table tickets add column if not exists key text`,
  `alter table tickets add column if not exists team text`,
  `alter table tickets add column if not exists raw jsonb not null default '{}'`,
  `alter table tickets add column if not exists applied jsonb not null default '[]'`,
  `do $$ begin
    if exists (select 1 from information_schema.columns where table_name = 'tickets' and column_name = 'number') then
      update tickets set key = number::text, source = 'github', id = 'github#' || number;
      alter table tickets drop column number;
      alter table tickets alter column key set not null;
    end if;
  end $$`,
  `create table if not exists contacts (
    id text primary key,
    source text not null,
    key text not null,
    name text not null,
    email text,
    phone text,
    company text,
    url text,
    raw jsonb not null default '{}',
    applied jsonb not null default '[]',
    updated_at timestamptz not null
  )`,
  `alter table documents add column if not exists applied jsonb not null default '[]'`,
  // What each sync path did: a row per ticket a webhook or a pull refreshed, with how far behind the copy was, and what reconciliation found.
  `create table if not exists sync_log (
    id serial primary key,
    source text not null,
    key text not null,
    path text not null,
    lag_s integer not null,
    at timestamptz not null default now()
  )`,
  // Cached reads per caller, and every read's outcome, so hit rate and staleness can be measured.
  `create table if not exists cache (
    tenant text not null,
    key text not null,
    value jsonb not null,
    fetched_at timestamptz not null default now(),
    primary key (tenant, key)
  )`,
  `create table if not exists cache_reads (
    tenant text not null,
    key text not null,
    outcome text not null,
    age_s integer not null,
    at timestamptz not null default now()
  )`,
  `create table if not exists syncs (
    source text primary key,
    pulled_at timestamptz not null,
    pulled integer not null
  )`,
  `create table if not exists filings (
    kind text not null,
    key text not null,
    number integer,
    url text,
    created_at timestamptz not null default now(),
    claimed_at timestamptz not null default now(),
    primary key (kind, key)
  )`,
  // A trace and a cached read name their caller: a visitor, a user, the terminal, the system. Tenant now means the customer.
  ...["traces", "cache", "cache_reads"].map(
    (table) => `do $$ begin
      if not exists (select 1 from information_schema.columns where table_name = '${table}' and column_name = 'caller') then
        alter table ${table} rename column tenant to caller;
      end if;
    end $$`,
  ),

  // People and services, the keys they sign in with, and the sessions a key opens in a browser; a key is stored only as its hash.
  `create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    role text not null check (role in ('viewer', 'agent', 'admin')),
    created_at timestamptz not null default now()
  )`,
  `create table if not exists keys (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    hash text not null unique,
    hint text not null,
    created_at timestamptz not null default now(),
    last_used_at timestamptz,
    revoked_at timestamptz
  )`,
  `create table if not exists sessions (
    hash text primary key,
    key_id uuid not null references keys(id) on delete cascade,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null
  )`,
  // The tokens a user connects for an integration, sealed: the plaintext never reaches the database.
  `create table if not exists credentials (
    user_id uuid not null references users(id) on delete cascade,
    provider text not null,
    ciphertext bytea not null,
    iv bytea not null,
    tag bytea not null,
    key_id text not null,
    created_at timestamptz not null default now(),
    sealed_at timestamptz not null default now(),
    primary key (user_id, provider)
  )`,
  // The path a document reached the model by: its text, or the file itself.
  `alter table documents add column if not exists path text`,
  // Spreadsheets uploaded to be asked about: the file as it came, and what reading it found.
  `create table if not exists sheets (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    bytes bytea not null,
    columns jsonb not null,
    rows integer not null,
    totals jsonb not null,
    created_at timestamptz not null default now()
  )`,
  // Every conversation on the server, whichever channels it ran on, as the messages the web renders.
  `create table if not exists conversations (
    id text primary key,
    person text not null,
    messages jsonb not null,
    updated_at timestamptz not null default now()
  )`,
  // A sender on a channel: who they are once linked, the conversation they continue, when they last wrote, and whether they asked to hear nothing more.
  `create table if not exists channels (
    channel text not null,
    address text not null,
    person text not null,
    conversation_id text not null,
    verified_at timestamptz,
    last_inbound_at timestamptz,
    opted_out_at timestamptz,
    primary key (channel, address)
  )`,
  // A one-time code that links a channel to a person and a conversation, kept as its hash until it is used or expires.
  `create table if not exists link_codes (
    hash text primary key,
    person text not null,
    conversation_id text,
    expires_at timestamptz not null
  )`,
  // A message sent on a channel: one per message it answers, and the provider's id and status come back by callback.
  `create table if not exists outbound (
    id uuid primary key default gen_random_uuid(),
    inbound text unique,
    channel text not null,
    address text not null,
    body text not null,
    status text not null default 'queued',
    sid text unique,
    attempts integer not null default 0,
    error text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`,
  // The chat bot's state: which threads it follows, locks, dedupe and queues, as keys with an expiry.
  `create table if not exists chat_state (
    key text primary key,
    value jsonb not null,
    expires_at timestamptz
  )`,
  // The entities content/entities describes; pnpm generate writes their statements.
  ...entityTables,
];

/**
 * Tenancy, applied after every table, generated ones included. Every row
 * belongs to the customer whose deployment wrote it (app.tenant, set on each
 * connection), and every query sees only those rows. The app runs as a role
 * that owns nothing and bypasses nothing, so the policies bind it.
 */
const tenancy = [
  `do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'workbot_app') then
      create role workbot_app nologin;
    end if;
  end $$`,
  `grant workbot_app to current_user`,
  `do $$
  declare t text;
  begin
    for t in select tablename from pg_tables where schemaname = 'public' loop
      execute format('alter table %I add column if not exists tenant text not null default nullif(current_setting(''app.tenant'', true), '''')', t);
      execute format('alter table %I enable row level security', t);
      execute format('alter table %I force row level security', t);
      if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'tenant_isolation') then
        execute format('create policy tenant_isolation on %I using (tenant = nullif(current_setting(''app.tenant'', true), '''')) with check (tenant = nullif(current_setting(''app.tenant'', true), ''''))', t);
      end if;
    end loop;
  end $$`,
  // A natural key is unique within a tenant, not across them.
  ...Object.entries({
    chunks: "path",
    prompts: "name, version",
    tickets: "id",
    contacts: "id",
    cache: "caller, key",
    syncs: "source",
    filings: "kind, key",
    conversations: "id",
    channels: "channel, address",
    link_codes: "hash",
    chat_state: "key",
  }).map(
    ([table, key]) => `do $$ begin
      if not exists (select 1 from information_schema.key_column_usage where table_name = '${table}' and constraint_name = '${table}_pkey' and column_name = 'tenant') then
        alter table ${table} drop constraint ${table}_pkey;
        alter table ${table} add primary key (tenant, ${key});
      end if;
    end $$`,
  ),
  `grant usage on schema public to workbot_app`,
  `grant select, insert, update, delete on all tables in schema public to workbot_app`,
  `grant usage, select on all sequences in schema public to workbot_app`,
];

export const schema = [...tables, ...tenancy];

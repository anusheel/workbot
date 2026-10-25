// The schema as idempotent statements, applied in order at startup. Append
// to change it; never edit an earlier statement.
import { entityTables } from "./entities/tables";

export const schema = [
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
      if exists (select 1 from information_schema.columns where table_name = '${table}' and column_name = 'tenant') then
        alter table ${table} rename column tenant to caller;
      end if;
    end $$`,
  ),
  // The entities content/entities describes; pnpm generate writes their statements.
  ...entityTables,
];

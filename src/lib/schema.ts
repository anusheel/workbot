// The schema as idempotent statements, applied in order at startup. Append
// to change it; never edit an earlier statement.
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
];

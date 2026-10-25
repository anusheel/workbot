// The schema as idempotent statements, applied in order at startup. Append
// to change it; never edit an earlier statement.
export const schema = [
  `create table if not exists requests (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null default '',
    team text not null,
    priority text not null default 'normal',
    status text not null default 'open',
    created_at timestamptz not null default now()
  )`,
];

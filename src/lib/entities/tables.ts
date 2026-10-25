// Generated from content/entities by pnpm generate. Edit a description, not this file.
// The schema spreads these; nothing is imported here, so the schema never waits on a module that needs the database.
export const entityTables = [
  `create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  manager text not null default '',
  phone text,
  kind text not null default 'warehouse',
  created_at timestamptz not null default now()
)`,
  `create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  terms text not null default 'net 30',
  notes text not null default '',
  created_at timestamptz not null default now()
)`,
];

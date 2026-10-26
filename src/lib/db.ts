import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import postgres from "postgres";
import { config } from "./config";
import { schema } from "./schema";

type Row = Record<string, unknown>;
export type Query = <T extends Row>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;
export type Connection = {
  query: Query;
  /** Calls `on` with each notification on the channel, for as long as the connection is open. */
  listen(channel: string, on: (payload: string) => void): Promise<void>;
  notify(channel: string, payload: string): Promise<void>;
  close(): Promise<void>;
};

/** The role every query runs as: it owns no table and bypasses nothing, so row-level security binds it. */
const appRole = "workbot_app";

// The Postgres driver throws on undefined; both connections send null instead.
const nullable = (params: unknown[]) =>
  params.map((param) => (param === undefined ? null : param));

/**
 * Connects to a postgres:// URL, or opens an embedded PGlite database at a
 * directory (`memory://` for none), bound to a tenant: every row it writes
 * is that tenant's, and every row it reads. Only the owner, which applies
 * the schema, connects as itself; anything else runs as the app's role. A
 * read-only connection rejects writes at the database, whatever SQL it is
 * handed.
 */
export function connect(
  database: string,
  { readOnly = false, owner = false, tenant = config.customer } = {},
): Connection {
  if (database.startsWith("postgres")) {
    const client = postgres(database, {
      // The owner works on one session, so the lock it takes holds for every statement it runs.
      ...(owner && { max: 1 }),
      connection: {
        options: [`-c app.tenant=${tenant}`, owner ? "" : `-c role=${appRole}`]
          .join(" ")
          .trim(),
        default_transaction_read_only: readOnly,
      },
      // "already exists, skipping" from the schema statements is expected; warnings are not.
      onnotice: (notice) =>
        notice.severity !== "NOTICE" && console.warn(notice.message),
    });
    return {
      query: async <T extends Row>(text: string, params: unknown[] = []) =>
        (await client.unsafe<T[]>(text, nullable(params) as never)) as T[],
      listen: async (channel, on) => {
        await client.listen(channel, on);
      },
      notify: async (channel, payload) => {
        await client.notify(channel, payload);
      },
      close: () => client.end(),
    };
  }
  const pg = new PGlite(database, { extensions: { vector } });
  const ready = (async () => {
    await pg.query(`select set_config('app.tenant', $1, false)`, [tenant]);
    if (!owner) await pg.exec(`set role ${appRole}`);
    if (readOnly) await pg.exec("set default_transaction_read_only = on");
  })();
  return {
    query: async <T extends Row>(text: string, params: unknown[] = []) => {
      await ready;
      return (await pg.query<T>(text, nullable(params))).rows;
    },
    listen: async (channel, on) => {
      await ready;
      await pg.listen(channel, on);
    },
    notify: async (channel, payload) => {
      await ready;
      await pg.query(`select pg_notify($1, $2)`, [channel, payload]);
    },
    close: () => pg.close(),
  };
}

/**
 * The owner applies the schema, then the app's own connection takes over.
 * An embedded database has one connection, so the owner steps down to the
 * app's role on it instead.
 */
const schemaVersion = createHash("sha256")
  .update(schema.join("\n"))
  .digest("hex");

async function prepare(database: string): Promise<Connection> {
  const owner = connect(database, { owner: true });
  // Instances that start together take turns: `create table if not exists` is not safe against itself.
  await owner.query(`select pg_advisory_lock(hashtext('workbot schema'))`);
  try {
    // Once per version of the schema: a replica starting under load would
    // otherwise take its tables' locks only to find nothing to change.
    await owner.query(
      `create table if not exists schema_version (hash text primary key)`,
    );
    const applied = await owner.query(
      `select 1 from schema_version where hash = $1`,
      [schemaVersion],
    );
    if (applied.length === 0) {
      for (const statement of schema) await owner.query(statement);
      await owner.query(
        `insert into schema_version (hash) values ($1) on conflict do nothing`,
        [schemaVersion],
      );
    }
  } finally {
    await owner.query(`select pg_advisory_unlock(hashtext('workbot schema'))`);
  }
  if (!database.startsWith("postgres")) {
    await owner.query(`set role ${appRole}`);
    return owner;
  }
  await owner.close();
  return connect(database);
}

// One connection per server process, opened on first use: each route is
// bundled on its own, and an embedded database must not be opened twice. A
// database that is not up yet is tried again on the next query, not given up on.
type Shared = typeof globalThis & { database?: Promise<Connection> };
const shared = globalThis as Shared;
const connection = () =>
  (shared.database ??= prepare(config.database).catch((error: unknown) => {
    shared.database = undefined;
    throw error;
  }));

export const query: Query = async (text, params) =>
  (await connection()).query(text, params);

/** Postgres's own publish and subscribe, for messages between server instances; a channel name is shared by every tenant on the database, so it names its tenant. */
export const listen: Connection["listen"] = async (channel, on) =>
  (await connection()).listen(channel, on);
export const notify: Connection["notify"] = async (channel, payload) =>
  (await connection()).notify(channel, payload);

/** Closes the shared connection. Scripts call it to exit; the server never does. */
export async function close() {
  await (await shared.database)?.close();
  shared.database = undefined;
}

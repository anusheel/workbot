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
export type Connection = { query: Query; close(): Promise<void> };

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
    close: () => pg.close(),
  };
}

/**
 * The owner applies the schema, then the app's own connection takes over.
 * An embedded database has one connection, so the owner steps down to the
 * app's role on it instead.
 */
async function prepare(database: string): Promise<Connection> {
  const owner = connect(database, { owner: true });
  for (const statement of schema) await owner.query(statement);
  if (!database.startsWith("postgres")) {
    await owner.query(`set role ${appRole}`);
    return owner;
  }
  await owner.close();
  return connect(database);
}

// One connection per server process, opened on first use: each route is
// bundled on its own, and an embedded database must not be opened twice.
type Shared = typeof globalThis & { database?: Promise<Connection> };
const shared = globalThis as Shared;
const connection = () => (shared.database ??= prepare(config.database));

export const query: Query = async (text, params) =>
  (await connection()).query(text, params);

/** Closes the shared connection. Scripts call it to exit; the server never does. */
export async function close() {
  await (await shared.database)?.close();
  shared.database = undefined;
}

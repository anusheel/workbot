import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { config } from "./config";
import { schema } from "./schema";

type Row = Record<string, unknown>;
export type Query = <T extends Row>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;
export type Connection = { query: Query; close(): Promise<void> };

/**
 * Connects to a postgres:// URL, or opens an embedded PGlite database at a
 * directory (`memory://` for none). A read-only connection rejects writes
 * at the database, whatever SQL it is handed.
 */
export function connect(
  database: string,
  { readOnly = false } = {},
): Connection {
  if (database.startsWith("postgres")) {
    const client = postgres(database, {
      connection: { default_transaction_read_only: readOnly },
      // "already exists, skipping" from the schema statements is expected; warnings are not.
      onnotice: (notice) =>
        notice.severity !== "NOTICE" && console.warn(notice.message),
    });
    return {
      query: async <T extends Row>(text: string, params: unknown[] = []) =>
        (await client.unsafe<T[]>(text, params as never)) as T[],
      close: () => client.end(),
    };
  }
  const pg = new PGlite(database);
  const ready = readOnly
    ? pg.exec("set default_transaction_read_only = on")
    : pg.waitReady;
  return {
    query: async <T extends Row>(text: string, params: unknown[] = []) => {
      await ready;
      return (await pg.query<T>(text, params)).rows;
    },
    close: () => pg.close(),
  };
}

async function prepare(database: string): Promise<Connection> {
  const connection = connect(database);
  for (const statement of schema) await connection.query(statement);
  return connection;
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

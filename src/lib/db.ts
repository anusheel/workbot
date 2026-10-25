import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import { config } from "./config";
import { schema } from "./schema";

type Row = Record<string, unknown>;
export type Query = <T extends Row>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

/**
 * Connects to a postgres:// URL, or opens an embedded PGlite database at a
 * directory (`memory://` for none). A read-only connection rejects writes
 * at the database, whatever SQL it is handed.
 */
export function connect(database: string, { readOnly = false } = {}): Query {
  if (database.startsWith("postgres")) {
    const client = postgres(database, {
      connection: { default_transaction_read_only: readOnly },
    });
    return async <T extends Row>(text: string, params: unknown[] = []) =>
      (await client.unsafe<T[]>(text, params as never)) as T[];
  }
  const pg = new PGlite(database);
  const ready = readOnly
    ? pg.exec("set default_transaction_read_only = on")
    : pg.waitReady;
  return async <T extends Row>(text: string, params: unknown[] = []) => {
    await ready;
    return (await pg.query<T>(text, params)).rows;
  };
}

async function prepare(database: string): Promise<Query> {
  const run = connect(database);
  for (const statement of schema) await run(statement);
  return run;
}

// One connection per server process: each route is bundled on its own, and
// an embedded database must not be opened twice.
type Shared = typeof globalThis & { database?: Promise<Query> };
const ready = ((globalThis as Shared).database ??= prepare(config.database));

export const query: Query = async (text, params) => (await ready)(text, params);

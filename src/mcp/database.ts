import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Query } from "@/lib/db";

const identifier = /^[a-z_][a-z0-9_]*$/;
const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
const rowLimit = 100;
const quoted = (name: string) => `"${name.replace(/"/g, '""')}"`;

/** Raw bytes would fill the model's context, so a binary value is shown as its size. */
const mask = (value: unknown): unknown =>
  value instanceof Uint8Array
    ? `<${value.byteLength} bytes>`
    : Array.isArray(value)
      ? value.map(mask)
      : value;
const readable = (rows: Record<string, unknown>[]) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, mask(value)]),
    ),
  );

/**
 * The statement with a limit of one row past the cap, so the database does the
 * cut and the extra row tells whether it was needed. Only a plain select is
 * wrapped, and only when nothing in it could break the parentheses: a
 * semicolon or a comment (also inside a string, which just skips the wrap).
 * EXPLAIN, SHOW and the rest run as written and are cut after they return.
 */
function limited(sql: string) {
  let end = sql.length;
  while (end > 0 && (sql[end - 1] === ";" || /\s/.test(sql[end - 1]))) end--;
  const statement = sql.slice(0, end);
  return /^\s*(select|with|table|values)\b/i.test(statement) &&
    !/;|--|\/\*/.test(statement)
    ? `select * from (${statement}) as limited limit ${rowLimit + 1}`
    : sql;
}
const failure = (err: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: err instanceof Error ? err.message : String(err),
    },
  ],
  isError: true,
});

async function tables(query: Query) {
  const rows = await query<{ name: string }>(
    `select table_name as name from information_schema.tables where table_schema = 'public' order by 1`,
  );
  return rows.map((r) => r.name);
}

async function columns(query: Query, table?: string) {
  return query<{ table: string; column: string; type: string }>(
    `select table_name as "table", column_name as "column", data_type as type, is_nullable = 'YES' as nullable, column_default as "default"
     from information_schema.columns
     where table_schema = 'public' and ($1::text is null or table_name = $1)
     order by table_name, ordinal_position`,
    [table ?? null],
  );
}

/** Read-only access to the application database, for Claude Code while building. */
export function databaseServer(query: Query) {
  const server = new McpServer({ name: "workbot-database", version: "1.0.0" });

  server.registerTool(
    "query",
    {
      description:
        "Run one SQL statement, meant to be a SELECT, and return up to 100 rows as JSON. `count` is the number of rows returned; `truncated: true` means more exist, so narrow the query with a where, an aggregate or your own limit. Binary values show as `<n bytes>` but are still read in full: name the columns rather than `select *` on a table of documents such as inbox.",
      inputSchema: {
        sql: z
          .string()
          .max(10_000)
          .describe("A single SQL statement, usually a SELECT"),
      },
    },
    async ({ sql }) => {
      try {
        const rows = await query(limited(sql));
        const cut = rows.length > rowLimit;
        return json({
          rows: readable(rows.slice(0, rowLimit)),
          count: Math.min(rows.length, rowLimit),
          ...(cut && { truncated: true }),
        });
      } catch (err) {
        return failure(err);
      }
    },
  );

  server.registerTool(
    "schema",
    {
      description:
        "Every table in the public schema with its columns and constraints.",
    },
    async () => {
      const [cols, constraints] = await Promise.all([
        columns(query),
        query(
          `select conrelid::regclass::text as "table", conname as name, pg_get_constraintdef(oid) as definition
           from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2`,
        ),
      ]);
      return json({ columns: cols, constraints });
    },
  );

  server.registerTool(
    "describe-table",
    {
      description: "One table: its columns, row count and 5 sample rows.",
      inputSchema: { table: z.string().regex(identifier) },
    },
    async ({ table }) => {
      if (!(await tables(query)).includes(table))
        return failure(`No table named ${table}`);
      const [cols, [{ count }]] = await Promise.all([
        columns(query, table),
        query<{ count: string | number }>(
          `select count(*) as count from ${table}`,
        ),
      ]);
      // A document's size comes from the database, so its bytes are never fetched
      // just to be replaced.
      const select = cols
        .map(({ column, type }) =>
          type === "bytea"
            ? `'<' || octet_length(${quoted(column)}) || ' bytes>' as ${quoted(column)}`
            : quoted(column),
        )
        .join(", ");
      return json({
        columns: cols,
        rows: Number(count),
        sample: readable(await query(`select ${select} from ${table} limit 5`)),
      });
    },
  );

  server.registerResource(
    "tables",
    "db://tables",
    {
      description: "The tables in the public schema, one per line",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, text: (await tables(query)).join("\n") }],
    }),
  );

  return server;
}

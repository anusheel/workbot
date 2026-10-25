import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Query } from "@/lib/db";

const identifier = /^[a-z_][a-z0-9_]*$/;
const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});
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
  return query(
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
        "Run one read-only SQL statement and return up to 100 rows as JSON.",
      inputSchema: {
        sql: z.string().describe("A single SELECT; writes are rejected"),
      },
    },
    async ({ sql }) => {
      try {
        const rows = await query(sql);
        return json({ rows: rows.slice(0, 100), count: rows.length });
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
    async () =>
      json({
        columns: await columns(query),
        constraints: await query(
          `select conrelid::regclass::text as "table", conname as name, pg_get_constraintdef(oid) as definition
           from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2`,
        ),
      }),
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
      const [{ count }] = await query<{ count: string | number }>(
        `select count(*) as count from ${table}`,
      );
      return json({
        columns: await columns(query, table),
        rows: Number(count),
        sample: await query(`select * from ${table} limit 5`),
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

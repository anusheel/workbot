import {
  type DuckDBValue,
  type Json,
  type DuckDBConnection,
  DuckDBInstance,
  StatementType,
  dateValue,
  timestampValue,
} from "@duckdb/node-api";
import type { LanguageModel } from "ai";
import ExcelJS from "exceljs";
import { z } from "zod";
import { type Limits, type Stopped, runAgent } from "./agent";
import { query } from "./db";
import { tool } from "./tool";

type Cell = string | number | boolean | Date | null;
export type ColumnType =
  "DOUBLE" | "DATE" | "TIMESTAMP" | "BOOLEAN" | "VARCHAR";
/** A column as SQL sees it: a name the model can type, the header it came from, and the type every value in it parses as. */
export type Column = { name: string; header: string; type: ColumnType };
/** A figure from the sheet's own totals row beside the sum of the rows above it. */
export type Total = { column: string; stated: number; summed: number };
export type Table = { columns: Column[]; rows: Cell[][]; totals: Total[] };

const day = 86_400_000;

/** What a cell holds once read: a formula's last result, a rich text's characters, a link's text; blank text is empty. */
function cellValue(value: ExcelJS.CellValue): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value !== "object" || value instanceof Date) return value;
  if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
  if ("richText" in value)
    return cellValue(value.richText.map((run) => run.text).join(""));
  if ("hyperlink" in value) return cellValue(value.text);
  return null;
}

/** One type for a column when every value in it agrees, text otherwise; dates with a time of day are timestamps. */
function typeOf(values: Cell[]): ColumnType {
  const kinds = new Set(
    values.flatMap((value) =>
      value === null
        ? []
        : value instanceof Date
          ? [value.getTime() % day ? "TIMESTAMP" : "DATE"]
          : [typeof value],
    ),
  );
  if (kinds.size === 2 && kinds.has("DATE") && kinds.has("TIMESTAMP"))
    return "TIMESTAMP";
  if (kinds.size !== 1) return "VARCHAR";
  const [kind] = kinds;
  return kind === "number"
    ? "DOUBLE"
    : kind === "boolean"
      ? "BOOLEAN"
      : kind === "DATE" || kind === "TIMESTAMP"
        ? kind
        : "VARCHAR";
}

const sqlName = (header: string, index: number) =>
  header
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `column_${index + 1}`;

/**
 * The first worksheet as a table. The header is the first of the top rows
 * whose cells are all distinct text, so a title merged across the columns
 * above it is passed over; a merged cell reads as the cell it was merged
 * from. A last row labelled Total is taken off the data and kept, each of its
 * figures beside the sum of its column, so a sheet whose totals do not
 * reconcile says so before anyone asks it a question.
 */
export async function readSheet(bytes: Uint8Array): Promise<Table> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS declares its own Buffer type, which a Uint8Array satisfies at run time.
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no worksheets.");
  const width = sheet.columnCount;
  const grid: Cell[][] = [];
  sheet.eachRow((row) =>
    grid.push(
      Array.from({ length: width }, (_, i) =>
        cellValue(row.getCell(i + 1).value),
      ),
    ),
  );

  const filled = (row: Cell[]) => row.filter((cell) => cell !== null);
  const top = grid.slice(0, 10);
  const widest = Math.max(0, ...top.map((row) => filled(row).length));
  const at = top.findIndex((row) => {
    const cells = filled(row);
    return (
      cells.length === widest &&
      cells.every((cell) => typeof cell === "string") &&
      new Set(cells).size === cells.length
    );
  });
  if (widest === 0 || at === -1)
    throw new Error("No header row: a row of distinct column names.");
  const positions = grid[at].flatMap((cell, i) => (cell === null ? [] : [i]));

  let rows = grid
    .slice(at + 1)
    .map((row) => positions.map((i) => row[i]))
    .filter((row) => filled(row).length > 0);
  const last = rows.at(-1);
  const label = last && filled(last)[0];
  const totalsRow =
    typeof label === "string" && /^(grand\s+)?totals?$/i.test(label)
      ? last
      : undefined;
  if (totalsRow) rows = rows.slice(0, -1);

  const used = new Set<string>();
  const columns = positions.map((position, i): Column => {
    const header = String(grid[at][position]);
    const base = sqlName(header, i);
    let name = base;
    for (let n = 2; used.has(name); n++) name = `${base}_${n}`;
    used.add(name);
    return { name, header, type: typeOf(rows.map((row) => row[i])) };
  });
  const totals = totalsRow
    ? columns.flatMap((column, i): Total[] => {
        const stated = totalsRow[i];
        if (typeof stated !== "number" || column.type !== "DOUBLE") return [];
        const summed = rows.reduce((sum, row) => sum + Number(row[i] ?? 0), 0);
        return [{ column: column.name, stated, summed }];
      })
    : [];
  return { columns, rows, totals };
}

/** Whether a stated total matches its column's sum, to the cent. */
export const reconciles = ({ stated, summed }: Total) =>
  Math.abs(stated - summed) < 0.005;

function duckValue(cell: Cell, type: ColumnType): DuckDBValue {
  if (cell === null) return null;
  if (type === "DATE")
    return dateValue(Math.round((cell as Date).getTime() / day));
  if (type === "TIMESTAMP")
    return timestampValue(BigInt((cell as Date).getTime() * 1000));
  if (type === "VARCHAR")
    return cell instanceof Date ? cell.toISOString() : String(cell);
  return cell as number | boolean;
}

export type Result = { columns: string[]; rows: Json[][]; more: boolean };
export type Sandbox = {
  query(
    sql: string,
    options?: { limit?: number; seconds?: number },
  ): Promise<Result>;
};

// The database lives in memory and may not touch a file, the network or its own settings.
const locked = {
  enable_external_access: "false",
  autoload_known_extensions: "false",
  autoinstall_known_extensions: "false",
  memory_limit: "256MB",
  threads: "2",
  lock_configuration: "true",
};

/** Loads the table into a sandbox as `sheet`, runs `fn` with it and closes it. */
export const withSandbox = <T>(
  table: Table,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<T> =>
  sandbox(async (setup) => {
    await setup.run(
      `create table sheet (${table.columns.map((c) => `"${c.name}" ${c.type}`).join(", ")})`,
    );
    const appender = await setup.createAppender("sheet");
    for (const row of table.rows) {
      row.forEach((cell, i) =>
        appender.appendValue(duckValue(cell, table.columns[i].type)),
      );
      appender.endRow();
    }
    appender.closeSync();
  }, fn);

/**
 * A DuckDB of its own, filled by `load`, for `fn`, closed after. A query is
 * one SELECT, read up to its row limit and stopped at its time limit; anything
 * else is refused before it runs.
 */
export async function sandbox<T>(
  load: (setup: DuckDBConnection) => Promise<void>,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<T> {
  const instance = await DuckDBInstance.create(":memory:", locked);
  try {
    const setup = await instance.connect();
    await load(setup);
    setup.closeSync();

    return await fn({
      async query(sql, { limit = 50, seconds = 5 } = {}) {
        const connection = await instance.connect();
        const timer = setTimeout(() => connection.interrupt(), seconds * 1000);
        try {
          const statements = await connection.extractStatements(sql);
          if (statements.count !== 1)
            throw new Error(
              `Send one statement at a time; this was ${statements.count}.`,
            );
          const prepared = await statements.prepare(0);
          if (prepared.statementType !== StatementType.SELECT)
            throw new Error("Only a SELECT runs here.");
          const reader = await prepared.runAndReadUntil(limit + 1);
          return {
            columns: reader.columnNames(),
            rows: reader.getRowsJson().slice(0, limit),
            more: reader.currentRowCount > limit || !reader.done,
          };
        } catch (error) {
          if (error instanceof Error && error.message.includes("Interrupted"))
            throw new Error(`The query ran past ${seconds} s and was stopped.`);
          throw error;
        } finally {
          clearTimeout(timer);
          connection.closeSync();
        }
      },
    });
  } finally {
    instance.closeSync();
  }
}

/** A query the model ran: its SQL and either the rows that came back or why none did. */
export type Query = { sql: string } & (Result | { error: string });
export type Answer = {
  answer: string;
  queries: Query[];
  dollars: number;
  stopped: Stopped;
};

/** The table as the model is told it: each column with its type and header, a reserved word quoted, and three rows. */
const describe = ({ columns, rows }: Table, reserved: Set<string>) =>
  [
    `The table sheet has ${rows.length} rows. Columns, with the header each came from:`,
    ...columns.map(
      (c) =>
        `- ${reserved.has(c.name) ? `"${c.name}"` : c.name} ${c.type} ("${c.header}")`,
    ),
    "The first rows:",
    ...rows.slice(0, 3).map((row) =>
      JSON.stringify(
        Object.fromEntries(
          columns.map((c, i) => {
            const cell = row[i];
            return [
              c.name,
              cell instanceof Date && c.type === "DATE"
                ? cell.toISOString().slice(0, 10)
                : cell,
            ];
          }),
        ),
      ),
    ),
  ].join("\n");

/**
 * Answers a question about a sheet by writing SQL: the model sees the
 * columns and three rows, never the table, and every figure in its answer
 * comes from a query it ran. The queries come back with the answer, so the
 * reader can check the SQL and the rows it returned.
 */
export async function ask(
  table: Table,
  question: string,
  model: LanguageModel,
  limits: Limits = { steps: 8, dollars: 0.2, seconds: 90 },
): Promise<Answer> {
  return withSandbox(table, async (sandbox) => {
    const keywords = await sandbox.query(
      "select keyword_name from duckdb_keywords() where keyword_category = 'reserved'",
      { limit: 1000 },
    );
    const reserved = new Set(keywords.rows.map(([word]) => String(word)));
    const queries: Query[] = [];
    const run = tool({
      name: "query",
      access: "viewer",
      description:
        "Runs one SELECT on the table sheet in DuckDB SQL and returns the column names and at most 50 rows as JSON, with more: true when there were more.",
      input: z.object({ sql: z.string().min(1) }),
      run: async ({ sql }) => {
        try {
          const result = await sandbox.query(sql);
          queries.push({ sql, ...result });
          return JSON.stringify(result);
        } catch (error) {
          queries.push({
            sql,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    });
    const { answer, dollars, stopped } = await runAgent({
      model,
      system: `You answer questions about a spreadsheet loaded into DuckDB. ${describe(table, reserved)}\n\nAnswer from queries: one SELECT per call to the query tool. A result holds at most 50 rows, so count, sum and group in SQL rather than reading rows. When a result answers the question, reply in one or two plain sentences with the figures from it, rounded as the question needs. If the columns cannot answer it, say so. No figure you did not query.`,
      task: question,
      tools: [run],
      limits,
    });
    return { answer, queries, dollars, stopped };
  });
}

export type SheetRecord = {
  id: string;
  name: string;
  columns: Column[];
  rows: number;
  totals: Total[];
  createdAt: Date;
};

const sheetColumns = `id, name, columns, rows, totals, created_at as "createdAt"`;

/** Reads the file before it is kept, so a sheet WorkBot cannot read is refused at the upload. */
export async function saveSheet(name: string, bytes: Uint8Array) {
  const table = await readSheet(bytes);
  const [row] = await query<SheetRecord>(
    // JSON goes in as text and is cast: the Postgres driver would encode a string a second time.
    `insert into sheets (name, bytes, columns, rows, totals) values ($1, $2, $3::text::jsonb, $4, $5::text::jsonb) returning ${sheetColumns}`,
    [
      name,
      bytes,
      JSON.stringify(table.columns),
      table.rows.length,
      JSON.stringify(table.totals),
    ],
  );
  return row;
}

export const listSheets = () =>
  query<SheetRecord>(
    `select ${sheetColumns} from sheets order by created_at desc limit 50`,
  );

export async function getSheet(id: string) {
  const [row] = await query<SheetRecord>(
    `select ${sheetColumns} from sheets where id = $1`,
    [id],
  );
  return row;
}

/** A stored sheet read again from its bytes, for a question. */
export async function tableOf(id: string) {
  const [row] = await query<{ bytes: Uint8Array }>(
    `select bytes from sheets where id = $1`,
    [id],
  );
  return row && readSheet(row.bytes);
}

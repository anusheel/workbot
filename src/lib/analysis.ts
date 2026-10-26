import { readFile, readdir } from "node:fs/promises";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { type Limits, runAgent } from "./agent";
import { type Query, sandbox } from "./sheets";
import { tool } from "./tool";

// The analytics: a dataset, the metrics defined in SQL files beside it, and
// data tests that must return no rows. The dataset is the seed's for now, in
// a locked DuckDB of its own; a deployment's copy of its tables loads the same way.
const dir = "content/analytics";

/** SQL text as statements, its comment lines dropped. */
const statements = (sql: string) =>
  sql
    .replace(/^--.*\n/gm, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

/** Each `.sql` file of a folder: its name, its first comment line as the title, and its query. */
async function definitions(folder: string) {
  const files = (await readdir(`${dir}/${folder}`))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return Promise.all(
    files.map(async (file) => {
      const text = await readFile(`${dir}/${folder}/${file}`, "utf8");
      return {
        name: file.replace(/\.sql$/, ""),
        title: text.match(/^-- (.*)/)?.[1] ?? file,
        sql: statements(text)[0],
      };
    }),
  );
}

export const metrics = () => definitions("metrics");

/** Runs `fn` against the analytics database, opened fresh and closed after. */
export async function withAnalytics<T>(fn: Parameters<typeof sandbox<T>>[1]) {
  const seed = await readFile(`${dir}/seed.sql`, "utf8");
  return sandbox(async (connection) => {
    for (const statement of statements(seed)) await connection.run(statement);
  }, fn);
}

/** The data tests that returned rows: each is a query that finds what must not be there. */
export async function failingTests() {
  const [tests, defined] = await Promise.all([definitions("tests"), metrics()]);
  return withAnalytics(async (db) => {
    const failing: string[] = [];
    for (const test of tests) {
      // A test may name a metric as {{name}} to check its results.
      const sql = test.sql.replace(
        /\{\{(\w+)\}\}/g,
        (_, name) => `(${defined.find((m) => m.name === name)?.sql})`,
      );
      if ((await db.query(sql, { limit: 1 })).rows.length)
        failing.push(test.name);
    }
    return failing;
  });
}

/** Every metric's rows, as the weekly report's tables. */
export async function report() {
  const defined = await metrics();
  return withAnalytics(async (db) =>
    Promise.all(
      defined.map(async (m) => ({
        ...m,
        result: await db.query(m.sql, { limit: 100 }),
      })),
    ),
  );
}

/**
 * A question about the product's use answered by writing SQL against the
 * analytics, read-only: one SELECT per call, 50 rows a result, a time limit
 * per query and a step and dollar limit per question. The metrics are its
 * definitions, so "retention" means what the team means by it. Every query
 * comes back with the answer.
 */
export async function analyst(
  question: string,
  model: LanguageModel,
  limits: Limits = { steps: 8, dollars: 0.2, seconds: 90 },
) {
  const defined = await metrics();
  return withAnalytics(async (db) => {
    const queries: Query[] = [];
    const query = tool({
      name: "query",
      access: "viewer",
      description:
        "Runs one SELECT in DuckDB SQL on the analytics tables and returns the column names and at most 50 rows as JSON.",
      input: z.object({ sql: z.string().min(1) }),
      run: async ({ sql }) => {
        try {
          const result = await db.query(sql);
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
    const system = [
      "You answer questions about how WorkBot is used, from the analytics tables in DuckDB.",
      "Tables: people (person, tenant, joined DATE) and activity (person, tenant, day DATE, kind: chat, request or document, dollars).",
      "The team's metric definitions, to use as written when a question names one:",
      ...defined.map((m) => `- ${m.title}\n${m.sql}`),
      "Answer from queries: count, sum and group in SQL. Reply in one or two plain sentences with the figures, rounded as the question needs. No figure you did not query.",
    ].join("\n");
    const { answer, dollars, stopped } = await runAgent({
      model,
      system,
      task: question,
      tools: [query],
      limits,
    });
    return { answer, queries, dollars, stopped };
  });
}

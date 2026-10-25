import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, expect, test, vi } from "vitest";
import { query } from "@/lib/db";
import { receive } from "@/lib/inbox";
import { createRequest } from "@/lib/requests";
import { databaseServer } from "./database";

const client = new Client({ name: "test", version: "1.0.0" });
const text = (result: Awaited<ReturnType<typeof client.callTool>>) =>
  (result.content as { text: string }[])[0].text;

beforeAll(async () => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await databaseServer(query).connect(serverTransport);
  await client.connect(clientTransport);
  await createRequest({
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "high",
  });
});

test("lists tables as a resource and describes one", async () => {
  const resource = await client.readResource({ uri: "db://tables" });
  expect((resource.contents[0] as { text: string }).text.split("\n")).toContain(
    "requests",
  );

  const described = JSON.parse(
    text(
      await client.callTool({
        name: "describe-table",
        arguments: { table: "requests" },
      }),
    ),
  );
  expect(described.rows).toBe(1);
  expect(described.columns.map((c: { column: string }) => c.column)).toContain(
    "created_at",
  );
  expect(described.sample[0].title).toBe("Replace the badge printer");
});

test("the schema tool returns columns and constraints", async () => {
  const schema = JSON.parse(text(await client.callTool({ name: "schema" })));
  expect(schema.constraints).toContainEqual({
    table: "requests",
    name: "requests_pkey",
    definition: "PRIMARY KEY (id)",
  });
});

test("the query tool runs selects and reports errors to the model", async () => {
  const ok = JSON.parse(
    text(
      await client.callTool({
        name: "query",
        arguments: { sql: "select team from requests" },
      }),
    ),
  );
  expect(ok).toEqual({ rows: [{ team: "operations" }], count: 1 });

  const bad = await client.callTool({
    name: "query",
    arguments: { sql: "select nope from requests" },
  });
  expect(bad.isError).toBe(true);
  expect(text(bad)).toMatch(/nope/);

  const unknown = await client.callTool({
    name: "describe-table",
    arguments: { table: "users" },
  });
  expect(unknown.isError).toBe(true);
});

test("binary values show as a placeholder with their size", async () => {
  await receive("note.pdf", "application/pdf", new Uint8Array([1, 2, 3, 4, 5]));
  const described = JSON.parse(
    text(
      await client.callTool({
        name: "describe-table",
        arguments: { table: "inbox" },
      }),
    ),
  );
  expect(described.sample[0].bytes).toBe("<5 bytes>");
});

async function spied() {
  const spy = vi.fn(query) as typeof query;
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const spied = new Client({ name: "test", version: "1.0.0" });
  await databaseServer(spy).connect(serverTransport);
  await spied.connect(clientTransport);
  const run = async (sql: string) =>
    JSON.parse(
      text(await spied.callTool({ name: "query", arguments: { sql } })),
    );
  return { run, sent: () => vi.mocked(spy).mock.calls.map(([text]) => text) };
}

test("the row limit goes to the database and the result says when it was cut", async () => {
  const { run, sent } = await spied();

  const result = await run("select n from generate_series(1, 150) n;");
  expect(result.rows).toHaveLength(100);
  expect(result.truncated).toBe(true);
  expect(sent()[0]).toMatch(/limit 101\s*$/i);

  const whole = await run("select n from generate_series(1, 3) n");
  expect(whole.count).toBe(3);
  expect(whole.truncated).toBeUndefined();

  expect((await run("select 1 as a ; ;")).rows).toEqual([{ a: 1 }]);
  expect(sent().at(-1)).toMatch(/limit 101\s*$/i);
});

test("statements that are not a plain select run as written and are cut afterwards", async () => {
  const { run, sent } = await spied();

  expect((await run("explain select 1")).rows.length).toBeGreaterThan(0);
  expect((await run("show server_version")).count).toBe(1);
  expect((await run("select 1 as a -- why")).rows).toEqual([{ a: 1 }]);
  expect((await run("select 1 as a; -- done")).rows).toEqual([{ a: 1 }]);
  expect(sent().some((sql) => /limited/.test(sql))).toBe(false);

  const all = await run("show all");
  expect(all.rows).toHaveLength(100);
  expect(all.truncated).toBe(true);
});

test("the query tool shows binary values as their size, also inside arrays", async () => {
  const result = await (
    await spied()
  ).run(
    `select bytes, array[bytes, '\\x0102'::bytea] as parts from inbox where name = 'note.pdf'`,
  );
  expect(result.rows[0]).toEqual({
    bytes: "<5 bytes>",
    parts: ["<5 bytes>", "<2 bytes>"],
  });
});

test("the query tool refuses a statement too long to be a question", async () => {
  const long = await client.callTool({
    name: "query",
    arguments: { sql: ";".repeat(10_001) },
  });
  expect(long.isError).toBe(true);
});

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

test("the row limit goes to the database and the result says when it was cut", async () => {
  const spy = vi.fn(query) as typeof query;
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const limited = new Client({ name: "test", version: "1.0.0" });
  await databaseServer(spy).connect(serverTransport);
  await limited.connect(clientTransport);

  const result = JSON.parse(
    text(
      await limited.callTool({
        name: "query",
        arguments: { sql: "select n from generate_series(1, 150) n;" },
      }),
    ),
  );
  expect(result.rows).toHaveLength(100);
  expect(result.truncated).toBe(true);
  expect(vi.mocked(spy).mock.calls[0][0]).toMatch(/limit 101\s*$/i);
});

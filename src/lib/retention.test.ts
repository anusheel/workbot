import { expect, test } from "vitest";
import { createUser, startSession } from "./auth";
import { query } from "./db";
import { receive } from "./inbox";
import { applyRetention } from "./retention";
import { recordTrace } from "./tracing";

const trace = (error: string | null = null) =>
  recordTrace({
    caller: "visitor-1",
    name: "chat",
    model: "claude-haiku-5-5",
    input: 1,
    output: 1,
    cached: 0,
    dollars: 0,
    ms: 1,
    ok: !error,
    error,
  });

test("a trace's error loses the email, the phone and the key it quoted", async () => {
  await trace(
    "400 from the provider: user dana@fieldstone.example (510) 555-0142, key sk-ant-api03-abcdefghijklmnop",
  );
  const [row] = await query<{ error: string }>(
    `select error from traces where error is not null`,
  );
  expect(row.error).toBe(
    "400 from the provider: user [email] [phone], key [secret]",
  );
});

test("what has outlived its window goes, and what has not stays", async () => {
  await trace();
  await trace();
  await query(
    `update traces set at = now() - interval '91 days' where id = (select id from traces order by at limit 1)`,
  );
  const { key } = await createUser("Dana", "viewer");
  await startSession(key);
  await startSession(key);
  await query(
    `update sessions set expires_at = now() - interval '1 minute' where hash = (select hash from sessions limit 1)`,
  );
  const item = await receive(
    "invoice.pdf",
    "application/pdf",
    new Uint8Array([1, 2, 3]),
  );
  await query(
    `update inbox set status = 'stored', updated_at = now() - interval '31 days' where id = $1`,
    [item.id],
  );

  expect(await applyRetention()).toMatchObject({
    traces: 1,
    sessions: 1,
    documentBytes: 1,
  });
  expect(await query(`select id from traces`)).toHaveLength(2);
  expect(await query(`select hash from sessions`)).toHaveLength(1);
  const [kept] = await query<{ status: string; size: number }>(
    `select status, length(bytes) as size from inbox where id = $1`,
    [item.id],
  );
  expect(kept).toEqual({ status: "stored", size: 0 });
  expect(await applyRetention()).toMatchObject({
    traces: 0,
    sessions: 0,
    documentBytes: 0,
  });
});

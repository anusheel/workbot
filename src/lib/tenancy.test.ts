import { expect, test } from "vitest";
import { query } from "./db";
import { createRequest, listRequests } from "./requests";
import { findTickets, fromIssue, upsertTicket } from "./unified";

// One database, two customers: the connection's tenant decides every row it sees and writes.
const as = (tenant: string) =>
  query(`select set_config('app.tenant', $1, false)`, [tenant]);
const ticket = (title: string) =>
  upsertTicket(
    fromIssue("acme/helpdesk", {
      number: 7,
      title,
      state: "OPEN",
      updated_at: "2026-10-20T08:00:00Z",
    }),
  );

test("a tenant reads only its own rows, keeps its own copy of a shared key, and cannot write as another", async () => {
  await createRequest({
    title: "Replace the badge printer",
    body: "",
    team: "operations",
    priority: "high",
  });
  await ticket("Van 3 brake light");

  await as("harbor-dental");
  expect(await listRequests()).toEqual([]);
  expect(await findTickets("brake")).toEqual([]);
  // The same issue number in another tenant's repository is its own row, not a conflict.
  await ticket("Chair 3 overhead light");
  expect((await findTickets("light")).map((t) => t.title)).toEqual([
    "Chair 3 overhead light",
  ]);
  await expect(
    query(
      `insert into requests (title, team, tenant) values ('Smuggled', 'operations', 'fieldstone')`,
    ),
  ).rejects.toThrow(/row-level security/);

  await as("fieldstone");
  expect((await listRequests()).map((r) => r.title)).toEqual([
    "Replace the badge printer",
  ]);
  expect((await findTickets("light")).map((t) => t.title)).toEqual([
    "Van 3 brake light",
  ]);
});

test("a connection with no tenant sees nothing and writes nothing", async () => {
  await query(`select set_config('app.tenant', '', false)`);
  expect(await listRequests()).toEqual([]);
  await expect(
    createRequest({
      title: "Orphan",
      body: "",
      team: "operations",
      priority: "normal",
    }),
  ).rejects.toThrow();
  await as("fieldstone");
});

test("the app's role owns nothing and bypasses nothing, and every table forces its policy", async () => {
  const [role] = await query(
    `select current_user as name, rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
  );
  expect(role).toEqual({
    name: "workbot_app",
    rolsuper: false,
    rolbypassrls: false,
  });
  const tables = await query<{ name: string; forced: boolean }>(
    `select c.relname as name, c.relrowsecurity and c.relforcerowsecurity as forced
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`,
  );
  expect(tables.map((t) => t.name)).toEqual(
    expect.arrayContaining(["requests", "tickets", "traces", "vendors"]),
  );
  expect(tables.filter((t) => !t.forced)).toEqual([]);
});

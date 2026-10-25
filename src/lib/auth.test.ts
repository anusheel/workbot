import { expect, test } from "vitest";
import {
  authorized,
  createUser,
  issueKey,
  listUsers,
  permits,
  revokeKey,
  startSession,
  userByKey,
  userOf,
} from "./auth";
import { query } from "./db";

test("a role grants everything below it, and the public nothing above it", () => {
  expect(permits("admin", "agent")).toBe(true);
  expect(permits("agent", "viewer")).toBe(true);
  expect(permits("viewer", "agent")).toBe(false);
  expect(permits("public", "viewer")).toBe(false);
  expect(permits("viewer", "public")).toBe(true);
});

test("a key is stored only as its hash, and works until it is revoked", async () => {
  const { user, key } = await createUser("Dana", "agent");
  expect(key).toMatch(/^wb_[\w-]{43}$/);
  const [stored] = await query<{ hash: string; hint: string }>(
    `select hash, hint from keys where user_id = $1`,
    [user.id],
  );
  expect(stored.hash).not.toContain(key.slice(3));
  expect(stored.hint).toBe(key.slice(-4));
  expect(await userByKey(key)).toMatchObject({ name: "Dana", role: "agent" });
  const [{ keys }] = await listUsers();
  await revokeKey(keys[0].id);
  expect(await userByKey(key)).toBeUndefined();
});

test("a second key works beside the first, so a client moves to it before the old one is revoked", async () => {
  const { user, key } = await createUser("Intake service", "agent");
  const next = await issueKey(user.id);
  expect(await userByKey(key)).toBeDefined();
  expect(await userByKey(next)).toBeDefined();
});

test("a session opens on a key, reads from its cookie, and ends when the key is revoked", async () => {
  const { user, key } = await createUser("Sam", "viewer");
  const session = await startSession(key);
  expect(session?.token).toMatch(/^ws_/);
  const browser = new Headers({
    cookie: `visitor=v1; session=${session?.token}`,
  });
  expect(await userOf(browser)).toEqual({
    id: user.id,
    name: "Sam",
    role: "viewer",
  });
  const [{ id }] = await query<{ id: string }>(
    `select id from keys where user_id = $1`,
    [user.id],
  );
  await revokeKey(id);
  expect(await userOf(browser)).toBeUndefined();
  expect(await startSession(key)).toBeUndefined();
});

test("an expired session is no one", async () => {
  const { key } = await createUser("Lee", "viewer");
  const session = await startSession(key);
  await query(`update sessions set expires_at = now() - interval '1 minute'`);
  expect(
    await userOf(new Headers({ cookie: `session=${session?.token}` })),
  ).toBeUndefined();
});

test("a route refuses no one with 401 and too low a role with 403", async () => {
  const { key } = await createUser("Viewer", "viewer");
  const call = (headers: Record<string, string>) =>
    authorized(new Request("http://workbot/api/x", { headers }), "agent");
  expect(((await call({})) as Response).status).toBe(401);
  expect(
    ((await call({ authorization: `Bearer ${key}` })) as Response).status,
  ).toBe(403);
  const { key: agent } = await createUser("Agent", "agent");
  expect(await call({ authorization: `Bearer ${agent}` })).toMatchObject({
    name: "Agent",
    role: "agent",
  });
});

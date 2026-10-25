import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { type Role, permits } from "./auth-model";
import type { Provider } from "./credentials";
import { query } from "./db";

export * from "./auth-model";
export type User = { id: string; name: string; role: Role };

const digest = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
const secret = (prefix: string) =>
  `${prefix}_${randomBytes(32).toString("base64url")}`;

/** A key for a user, returned once and stored only as its hash; the user's other keys keep working until revoked, so a client moves to a new one without downtime. */
export async function issueKey(userId: string): Promise<string> {
  const key = secret("wb");
  await query(`insert into keys (user_id, hash, hint) values ($1, $2, $3)`, [
    userId,
    digest(key),
    key.slice(-4),
  ]);
  return key;
}

/** A person or a service, and its first key. */
export async function createUser(
  name: string,
  role: Role,
): Promise<{ user: User; key: string }> {
  const [user] = await query<User>(
    `insert into users (name, role) values ($1, $2) returning id, name, role`,
    [name, role],
  );
  return { user, key: await issueKey(user.id) };
}

/** Revokes a key, and with it every session it opened. */
export const revokeKey = (id: string) =>
  query(
    `update keys set revoked_at = now() where id = $1 and revoked_at is null`,
    [id],
  );

export type Key = {
  id: string;
  hint: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

/** Every user with their keys and the integrations they connected, newest first; a key shows only its last 4 characters. */
export const listUsers = () =>
  query<User & { createdAt: Date; keys: Key[]; connections: Provider[] }>(
    `select users.id, users.name, users.role, users.created_at as "createdAt",
       array(select provider from credentials where credentials.user_id = users.id order by provider) as connections,
       coalesce(json_agg(json_build_object('id', keys.id, 'hint', keys.hint, 'createdAt', keys.created_at,
         'lastUsedAt', keys.last_used_at, 'revokedAt', keys.revoked_at) order by keys.created_at desc)
         filter (where keys.id is not null), '[]') as keys
     from users left join keys on keys.user_id = users.id
     group by users.id order by users.created_at desc`,
  );

/** The user a live key belongs to, noting when it was used. */
export async function userByKey(
  key: string,
): Promise<(User & { keyId: string }) | undefined> {
  const [row] = await query<User & { keyId: string }>(
    `update keys set last_used_at = now() from users
     where keys.hash = $1 and keys.revoked_at is null and users.id = keys.user_id
     returning users.id, users.name, users.role, keys.id as "keyId"`,
    [digest(key)],
  );
  return row;
}

const sessionDays = 7;
export const sessionCookie = "session";

/** Opens a browser session on a live key: a fresh token in the cookie, its hash here, ended by a sign-out, the expiry or the key's revocation. */
export async function startSession(
  key: string,
): Promise<{ token: string; user: User; maxAge: number } | undefined> {
  const found = await userByKey(key);
  if (!found) return undefined;
  const token = secret("ws");
  await query(
    `insert into sessions (hash, key_id, expires_at) values ($1, $2, now() + make_interval(days => $3))`,
    [digest(token), found.keyId, sessionDays],
  );
  const { keyId: _, ...user } = found;
  return { token, user, maxAge: sessionDays * 86_400 };
}

export async function userBySession(token: string): Promise<User | undefined> {
  const [row] = await query<User>(
    `select users.id, users.name, users.role from sessions
     join keys on keys.id = sessions.key_id and keys.revoked_at is null
     join users on users.id = keys.user_id
     where sessions.hash = $1 and sessions.expires_at > now()`,
    [digest(token)],
  );
  return row;
}

export const endSession = (token: string) =>
  query(`delete from sessions where hash = $1`, [digest(token)]);

const cookieOf = (header: string | null, name: string) =>
  header
    ?.split(/;\s*/)
    .find((pair) => pair.startsWith(`${name}=`))
    ?.slice(name.length + 1);

/** Who a request comes from: a bearer key on an API call, the session cookie in a browser, no one otherwise. */
export async function userOf(headers: Headers): Promise<User | undefined> {
  const authorization = headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const found = await userByKey(authorization.slice(7));
    if (!found) return undefined;
    const { keyId: _, ...user } = found;
    return user;
  }
  const token = cookieOf(headers.get("cookie"), sessionCookie);
  return token ? userBySession(token) : undefined;
}

export const currentUser = async () => userOf(await headers());

/** For a page or a server action: the user, sent to sign in when there is none and refused when the role is too low. */
export async function requireUser(need: Role = "viewer"): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");
  if (!permits(user.role, need))
    throw new Error(`The ${user.role} role cannot do this; it takes ${need}.`);
  return user;
}

/** For a route handler: the caller, or the response that refuses them, 401 for no one and 403 for too low a role. */
export async function authorized(
  request: Request,
  need: Role,
): Promise<User | Response> {
  const user = await userOf(request.headers);
  if (!user)
    return Response.json(
      { error: "Sign in, or send a key as a bearer token" },
      { status: 401 },
    );
  if (!permits(user.role, need))
    return Response.json(
      { error: `The ${user.role} role cannot do this; it takes ${need}` },
      { status: 403 },
    );
  return user;
}

import { randomUUID } from "node:crypto";
import type { Lock, QueueEntry, StateAdapter } from "chat";
import { query } from "./db";

const live = `(expires_at is null or expires_at > now())`;
const expiry = (ttlMs?: number) =>
  ttlMs ? new Date(Date.now() + ttlMs) : null;
const json = (value: unknown) => JSON.stringify(value);

/**
 * The Chat SDK's state in WorkBot's own database: the threads the bot
 * follows, a lock per thread, deduplication keys and message queues, each
 * a key with an optional expiry in one table. Being an ordinary table, it is
 * separated by tenant like every other, which an adapter with its own
 * connection would not be. Each operation is one statement, so it is atomic
 * across instances.
 */
export function databaseState(): StateAdapter {
  const get = async <T>(key: string) =>
    (
      await query<{ value: T }>(
        `select value from chat_state where key = $1 and ${live}`,
        [key],
      )
    )[0]?.value ?? null;
  const set = async (key: string, value: unknown, ttlMs?: number) => {
    // JSON goes in as text and is cast: the Postgres driver would encode a string a second time.
    await query(
      `insert into chat_state (key, value, expires_at) values ($1, $2::text::jsonb, $3)
       on conflict (tenant, key) do update set value = excluded.value, expires_at = excluded.expires_at`,
      [key, json(value), expiry(ttlMs)],
    );
  };
  // An expired row counts as absent, so it is taken over rather than refused.
  const setIfNotExists = async (key: string, value: unknown, ttlMs?: number) =>
    (
      await query(
        `insert into chat_state (key, value, expires_at) values ($1, $2::text::jsonb, $3)
         on conflict (tenant, key) do update set value = excluded.value, expires_at = excluded.expires_at
         where chat_state.expires_at is not null and chat_state.expires_at <= now()
         returning key`,
        [key, json(value), expiry(ttlMs)],
      )
    ).length > 0;
  const remove = async (key: string) => {
    await query(`delete from chat_state where key = $1`, [key]);
  };
  // Appends and keeps the newest `maxLength`, in one statement; a list past its expiry starts again.
  const append = async (
    key: string,
    value: unknown,
    { maxLength, ttlMs }: { maxLength?: number; ttlMs?: number } = {},
  ) =>
    (
      await query<{ length: number }>(
        `insert into chat_state (key, value, expires_at) values ($1, jsonb_build_array($2::text::jsonb), $4)
         on conflict (tenant, key) do update set expires_at = excluded.expires_at, value = (
           select coalesce(jsonb_agg(item order by n), '[]'::jsonb) from (
             select item, n from jsonb_array_elements(
               case when chat_state.expires_at is null or chat_state.expires_at > now() then chat_state.value else '[]'::jsonb end
               || excluded.value
             ) with ordinality as list(item, n)
             order by n desc limit coalesce($3::int, 2147483647)
           ) kept
         )
         returning jsonb_array_length(value) as length`,
        [key, json(value), maxLength ?? null, expiry(ttlMs)],
      )
    )[0].length;
  const lockKey = (threadId: string) => `lock:${threadId}`;
  const queueKey = (threadId: string) => `queue:${threadId}`;

  return {
    connect: async () => {},
    disconnect: async () => {},
    get,
    set,
    setIfNotExists,
    delete: remove,
    subscribe: (threadId) => set(`subscribed:${threadId}`, true),
    unsubscribe: (threadId) => remove(`subscribed:${threadId}`),
    isSubscribed: async (threadId) =>
      (await get(`subscribed:${threadId}`)) !== null,
    async acquireLock(threadId, ttlMs): Promise<Lock | null> {
      const token = randomUUID();
      return (await setIfNotExists(lockKey(threadId), token, ttlMs))
        ? { threadId, token, expiresAt: Date.now() + ttlMs }
        : null;
    },
    async extendLock(lock, ttlMs) {
      const extended = await query(
        `update chat_state set expires_at = $3 where key = $1 and value = to_jsonb($2::text) and ${live} returning key`,
        [lockKey(lock.threadId), lock.token, expiry(ttlMs)],
      );
      return extended.length > 0;
    },
    async releaseLock(lock) {
      await query(
        `delete from chat_state where key = $1 and value = to_jsonb($2::text)`,
        [lockKey(lock.threadId), lock.token],
      );
    },
    forceReleaseLock: (threadId) => remove(lockKey(threadId)),
    appendToList: async (key, value, options) => {
      await append(key, value, options);
    },
    getList: async <T>(key: string) => (await get<T[]>(key)) ?? [],
    enqueue: (threadId, entry, maxSize) =>
      append(queueKey(threadId), entry, { maxLength: maxSize }),
    async dequeue(threadId) {
      const [row] = await query<{ entry: QueueEntry | null }>(
        // The FROM clause reads the row as it was, so the head comes back as it is removed; only the thread's lock holder dequeues.
        `update chat_state c set value = c.value - 0::integer
         from (select value->0 as entry from chat_state where key = $1) head
         where c.key = $1 returning head.entry`,
        [queueKey(threadId)],
      );
      return row?.entry ?? null;
    },
    queueDepth: async (threadId) =>
      (await get<unknown[]>(queueKey(threadId)))?.length ?? 0,
  };
}

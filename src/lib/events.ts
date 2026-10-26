import { z } from "zod";
import { capture } from "./analytics";
import { deadLetter } from "./dead-letters";
import { query } from "./db";
import { notifyOnce } from "./notify";

/** Something that happened, as producers write it and consumers read it. */
export type DomainEvent = {
  id: string;
  topic: string;
  version: number;
  key: string;
  data: unknown;
  createdAt: Date;
};

/**
 * The readers of each event schema, by topic and version, like an API's.
 * Each reads the fields it needs and lets others pass, so a producer can add
 * a field without breaking a consumer; a change that would break one is a
 * new version.
 */
const readers = {
  "request.created@1": z.looseObject({
    id: z.string(),
    title: z.string(),
    team: z.string(),
    priority: z.string(),
  }),
};
const read = <T extends keyof typeof readers>(
  name: T,
  event: DomainEvent,
): z.infer<(typeof readers)[T]> => {
  if (`${event.topic}@${event.version}` !== name)
    throw new Error(`No reader for ${event.topic} version ${event.version}`);
  return readers[name].parse(event.data);
};

type Consumer = {
  name: string;
  topics: string[];
  handle(event: DomainEvent): Promise<void>;
};

/**
 * Who reads the events. Delivery is at least once, so a consumer whose work
 * must not repeat makes it idempotent by the event's id: a notification is
 * made once. Analytics accepts the rare repeat after a crash.
 */
export const consumers: Consumer[] = [
  {
    name: "notifications",
    topics: ["request.created"],
    handle: async (event) => {
      const request = read("request.created@1", event);
      await notifyOnce(
        event.id,
        request.team,
        `New request: ${request.title}`,
        `/requests/${request.id}`,
      );
    },
  },
  {
    name: "analytics",
    topics: ["request.created"],
    handle: async (event) => {
      const { team, priority } = read("request.created@1", event);
      await capture("request_created", "workbot", { team, priority });
    },
  },
];

/** Hands a dead-lettered event to its consumer again, as a person does once the cause is fixed. */
export async function redeliver(consumerName: string, event: DomainEvent) {
  const consumer = consumers.find((c) => c.name === consumerName);
  if (!consumer) throw new Error(`No consumer ${consumerName}`);
  await consumer.handle(event);
}

const failuresAllowed = 3;

/**
 * Hands each consumer the events after the last one it finished, in order,
 * and moves its position past each one done. A consumer that fails stops
 * where it is, to try that event again on the next pass; on its third
 * failure the event is dead-lettered and passed, so one bad event cannot
 * hold up the ones behind it. Returns how many each consumer finished.
 */
export async function dispatch(batch = 500) {
  const finished: Record<string, number> = {};
  for (const consumer of consumers) {
    finished[consumer.name] = 0;
    await query(
      `insert into event_offsets (consumer) values ($1) on conflict do nothing`,
      [consumer.name],
    );
    const [current] = await query<{
      tx: string;
      position: string;
      failures: number;
    }>(
      `select tx::text, position::text, failures from event_offsets where consumer = $1`,
      [consumer.name],
    );
    // Failures count against the event the consumer is stuck at; each event passed starts the count again.
    let failures = current.failures;
    // Only events from transactions older than every one still running: none of those can still commit, so nothing is passed before it is visible.
    const events = await query<DomainEvent & { tx: string }>(
      `select id::text, tx::text, topic, version, key, data, created_at as "createdAt" from events
       where (tx, id) > ($1::xid8, $2::bigint) and topic = any($3)
         and tx < pg_snapshot_xmin(pg_current_snapshot())
       order by tx, id limit $4`,
      [current.tx, current.position, consumer.topics, batch],
    );
    for (const event of events) {
      try {
        await consumer.handle(event);
      } catch (error) {
        if (failures + 1 < failuresAllowed) {
          await query(
            `update event_offsets set failures = failures + 1 where consumer = $1`,
            [consumer.name],
          );
          break;
        }
        await deadLetter(
          `event:${consumer.name}`,
          event.key,
          event,
          error,
          failures + 1,
        );
      }
      await query(
        `update event_offsets set tx = $2::xid8, position = $3, failures = 0 where consumer = $1`,
        [consumer.name, event.tx, event.id],
      );
      failures = 0;
      finished[consumer.name]++;
    }
  }
  return finished;
}

/** Each consumer's position, the events still ahead of it, and its failures on the one it is at. */
export async function consumerLag() {
  return Promise.all(
    consumers.map(async ({ name, topics }) => {
      const [row] = await query<{
        position: string;
        behind: number;
        failures: number;
      }>(
        `select coalesce(o.position, 0)::text as position, coalesce(o.failures, 0) as failures,
           (select count(*)::int from events e
            where (e.tx, e.id) > (coalesce(o.tx, '0'::xid8), coalesce(o.position, 0)) and e.topic = any($2)) as behind
         from (select 1) one left join event_offsets o on o.consumer = $1`,
        [name, topics],
      );
      return { name, ...row };
    }),
  );
}

/** The events most recently written, for the page that shows them. */
export const recentEvents = (limit = 10) =>
  query<DomainEvent>(
    `select id::text, topic, version, key, data, created_at as "createdAt" from events order by id desc limit $1`,
    [limit],
  );

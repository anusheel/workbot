import { io } from "next/cache";
import { query } from "./db";

export type Notification = {
  id: string;
  recipient: string;
  message: string;
  link: string | null;
  createdAt: Date;
};

const columns = `id, recipient, message, link, created_at as "createdAt"`;

/**
 * The outbox: what a mail or chat integration would send, kept so the
 * dashboard can show it. Nothing leaves the database until one is wired in.
 */
export async function notify(
  recipient: string,
  message: string,
  link?: string,
): Promise<Notification> {
  const [row] = await query<Notification>(
    `insert into notifications (recipient, message, link) values ($1, $2, $3) returning ${columns}`,
    [recipient, message, link ?? null],
  );
  return row;
}

/** A notification for an event, made once: reading the event again finds it already there. */
export async function notifyOnce(
  eventId: string,
  recipient: string,
  message: string,
  link?: string,
) {
  await query(
    `insert into notifications (recipient, message, link, event_id) values ($1, $2, $3, $4) on conflict (event_id) do nothing`,
    [recipient, message, link ?? null, eventId],
  );
}

export async function listNotifications(limit = 10): Promise<Notification[]> {
  await io();
  return query<Notification>(
    `select ${columns} from notifications order by created_at desc limit $1`,
    [limit],
  );
}

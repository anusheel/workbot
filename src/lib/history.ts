import type { UIMessage } from "ai";
import { query } from "./db";

/** A conversation as the server keeps it: whose it is, and its messages as the web renders them, each marked with the channel it came by. */
export type History = {
  id: string;
  person: string;
  messages: UIMessage<{ channel?: string }>[];
  updatedAt: Date;
};

const columns = `id, person, messages, updated_at as "updatedAt"`;

/** A conversation by its id, only for the person it belongs to. */
export async function historyOf(id: string, person: string) {
  const [row] = await query<History>(
    `select ${columns} from conversations where id = $1 and person = $2`,
    [id, person],
  );
  return row;
}

/** A conversation by its id, for the people who look after the channels. */
export async function historyById(id: string) {
  const [row] = await query<History>(
    `select ${columns} from conversations where id = $1`,
    [id],
  );
  return row;
}

/** Keeps a conversation's latest messages; another person's conversation under the same id is left as it was. */
export async function saveHistory(
  id: string,
  person: string,
  messages: UIMessage[],
) {
  // JSON goes in as text and is cast: the Postgres driver would encode a string a second time.
  await query(
    `insert into conversations (id, person, messages) values ($1, $2, $3::text::jsonb)
     on conflict (tenant, id) do update set messages = excluded.messages, updated_at = now()
     where conversations.person = excluded.person`,
    [id, person, JSON.stringify(messages)],
  );
}

/** The latest conversations, for the people who look after the channels. */
export const recentHistories = (limit = 20) =>
  query<History>(
    `select ${columns} from conversations order by updated_at desc limit $1`,
    [limit],
  );

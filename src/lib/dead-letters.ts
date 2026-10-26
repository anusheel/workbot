import { query } from "./db";

/** Work that failed after its retries: where it came from, whose it was, what it carried, why it failed. */
export type DeadLetter = {
  id: string;
  source: string;
  owner: string | null;
  payload: unknown;
  error: string;
  attempts: number | null;
  replayedAt: Date | null;
  createdAt: Date;
};

const columns = `id, source, owner, payload, error, attempts, replayed_at as "replayedAt", created_at as "createdAt"`;

/** Keeps a failure for a person to look at; the work it describes stops being retried. */
export async function deadLetter(
  source: string,
  owner: string | null,
  payload: unknown,
  error: unknown,
  attempts?: number,
) {
  await query(
    `insert into dead_letters (source, owner, payload, error, attempts) values ($1, $2, $3::text::jsonb, $4, $5)`,
    [
      source,
      owner,
      JSON.stringify(payload),
      error instanceof Error ? error.message : String(error),
      attempts ?? null,
    ],
  );
}

export const listDeadLetters = (limit = 50) =>
  query<DeadLetter>(
    `select ${columns} from dead_letters order by created_at desc limit $1`,
    [limit],
  );

/** Takes a dead letter out for another try, once: a second replay of the same letter finds nothing. */
export async function claimForReplay(id: string) {
  const [row] = await query<DeadLetter>(
    `update dead_letters set replayed_at = now() where id = $1 and replayed_at is null returning ${columns}`,
    [id],
  );
  return row;
}

/** How many are waiting for a person, by where they came from and whose they were. */
export const deadLetterCounts = () =>
  query<{ source: string; owner: string | null; count: number }>(
    `select source, owner, count(*)::int as count from dead_letters where replayed_at is null group by source, owner order by count desc`,
  );

import { query } from "./db";
import { type Sealed, currentKeyId, open, seal } from "./secrets";

/** The integrations a user can connect a token for. */
export const providers = ["github"] as const;
export type Provider = (typeof providers)[number];

type Row = Sealed & { userId: string; provider: Provider };
const columns = `user_id as "userId", provider, ciphertext, iv, tag, key_id as "keyId"`;

/** Seals a user's token for an integration and keeps it, replacing any before it. */
export async function saveCredential(
  userId: string,
  provider: Provider,
  token: string,
) {
  const sealed = seal(token);
  await query(
    `insert into credentials (user_id, provider, ciphertext, iv, tag, key_id) values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id, provider) do update set ciphertext = excluded.ciphertext, iv = excluded.iv,
       tag = excluded.tag, key_id = excluded.key_id, sealed_at = now()`,
    [userId, provider, sealed.ciphertext, sealed.iv, sealed.tag, sealed.keyId],
  );
}

/** A user's token for an integration, opened for the call that needs it; nothing when they have none. */
export async function credentialFor(
  userId: string,
  provider: Provider,
): Promise<string | undefined> {
  const [row] = await query<Row>(
    `select ${columns} from credentials where user_id = $1 and provider = $2`,
    [userId, provider],
  );
  return row && open(row);
}

export const revokeCredential = (userId: string, provider: Provider) =>
  query(`delete from credentials where user_id = $1 and provider = $2`, [
    userId,
    provider,
  ]);

/** Which integrations a user has connected, and when; never the token. */
export const connections = (userId: string) =>
  query<{ provider: Provider; sealedAt: Date }>(
    `select provider, sealed_at as "sealedAt" from credentials where user_id = $1 order by provider`,
    [userId],
  );

/** Seals again, under the current key, every token an older key sealed; returns how many. After it, the old key can go. */
export async function reseal(): Promise<number> {
  const stale = await query<Row>(
    `select ${columns} from credentials where key_id <> $1`,
    [currentKeyId()],
  );
  for (const row of stale)
    await saveCredential(row.userId, row.provider, open(row));
  return stale.length;
}

import { io } from "next/cache";
import { query } from "./db";

export type Prompt = {
  name: string;
  version: number;
  text: string;
  note: string;
  /** The share of traffic this version gets, 0 to 100; the shares of a prompt sum to 100. */
  share: number;
  createdAt: Date;
};

const columns = `name, version, text, note, share, created_at as "createdAt"`;

export async function versions(name: string): Promise<Prompt[]> {
  await io();
  return query<Prompt>(
    `select ${columns} from prompts where name = $1 order by version desc`,
    [name],
  );
}

/** A new version, off traffic until it is given a share. */
export async function addVersion(
  name: string,
  text: string,
  note = "",
): Promise<Prompt> {
  const [row] = await query<Prompt>(
    `insert into prompts (name, version, text, note, share)
     values ($1, coalesce((select max(version) from prompts where name = $1), 0) + 1, $2, $3, 0)
     returning ${columns}`,
    [name, text, note],
  );
  return row;
}

/** Splits the traffic of a prompt between its versions; the shares must add up to 100. */
export async function setShares(
  name: string,
  shares: Record<number, number>,
): Promise<void> {
  const known = new Set((await versions(name)).map((row) => row.version));
  for (const [version, share] of Object.entries(shares)) {
    if (!known.has(Number(version)))
      throw new Error(`Version ${version} of ${name} does not exist.`);
    if (!Number.isInteger(share) || share < 0 || share > 100)
      throw new Error(
        `Share ${share} for version ${version} is not a whole number from 0 to 100.`,
      );
  }
  const total = Object.values(shares).reduce((sum, share) => sum + share, 0);
  if (total !== 100) throw new Error(`Shares add up to ${total}, not 100.`);
  await query(`update prompts set share = 0 where name = $1`, [name]);
  for (const [version, share] of Object.entries(shares))
    await query(
      `update prompts set share = $3 where name = $1 and version = $2`,
      [name, Number(version), share],
    );
}

// FNV-1a: a stable bucket per caller, so the same person keeps the same version.
const bucket = (caller: string) => {
  let hash = 0x811c9dc5;
  for (const char of caller)
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return (hash >>> 0) % 100;
};

/**
 * The prompt a call uses: the live versions, split by their shares and
 * chosen by the caller's bucket. A prompt not yet in the database is
 * seeded from the code's text as version 1, on all of the traffic.
 */
export async function promptOf(
  name: string,
  caller: string,
  seed: string,
): Promise<Pick<Prompt, "version" | "text">> {
  let rows = await versions(name);
  if (rows.length === 0) {
    // Two first requests at once both seed version 1; the primary key keeps one, and both read it back.
    await query(
      `insert into prompts (name, version, text, note, share) values ($1, 1, $2, 'the prompt as written in code', 100) on conflict (tenant, name, version) do nothing`,
      [name, seed],
    );
    rows = await versions(name);
  }
  const live = rows
    .filter((row) => row.share > 0)
    .sort((a, b) => a.version - b.version);
  if (live.length === 0) return rows[0];
  let edge = 0;
  const point = bucket(caller);
  for (const row of live) {
    edge += row.share;
    if (point < edge) return row;
  }
  return live.at(-1)!;
}

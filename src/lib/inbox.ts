import { io } from "next/cache";
import { query } from "./db";
import type { DocumentType } from "./document-model";
import type { MediaType } from "./extract";

/** Where a document is in the approval workflow. */
export const inboxStatuses = [
  "received",
  "extracted",
  "awaiting_review",
  "stored",
  "rejected",
  "expired",
  "failed",
] as const;
export type InboxStatus = (typeof inboxStatuses)[number];

export type InboxItem = {
  id: string;
  name: string;
  mediaType: MediaType;
  status: InboxStatus;
  type: DocumentType | null;
  data: Record<string, unknown> | null;
  confidence: Record<string, number> | null;
  review: string[];
  requestId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const columns = `id, name, media_type as "mediaType", status, type, data, confidence, review, request_id as "requestId", created_at as "createdAt", updated_at as "updatedAt"`;

/** A document arrives: its bytes are kept, so every step of the workflow can read it again. */
export async function receive(
  name: string,
  mediaType: MediaType,
  bytes: Uint8Array,
): Promise<InboxItem> {
  const [row] = await query<InboxItem>(
    `insert into inbox (name, media_type, bytes) values ($1, $2, $3) returning ${columns}`,
    [name, mediaType, bytes],
  );
  return row;
}

export async function fileOf(
  id: string,
): Promise<{ data: Uint8Array; mediaType: MediaType } | undefined> {
  const [row] = await query<{ bytes: Uint8Array; mediaType: MediaType }>(
    `select bytes, media_type as "mediaType" from inbox where id = $1`,
    [id],
  );
  return row && { data: new Uint8Array(row.bytes), mediaType: row.mediaType };
}

/** A run that gave up after its retries: the row says so, with the reason, instead of staying "received" forever. */
export async function markFailed(id: string, reason: string): Promise<void> {
  await query(
    `update inbox set status = 'failed', review = $2, updated_at = now() where id = $1`,
    [id, [reason]],
  );
}

/** Removes documents whose runs never started, so an upload fails whole or not at all. */
export async function discard(ids: string[]): Promise<void> {
  await query(`delete from inbox where id = any($1::uuid[])`, [ids]);
}

export async function getItem(id: string): Promise<InboxItem | undefined> {
  const [row] = await query<InboxItem>(
    `select ${columns} from inbox where id = $1`,
    [id],
  );
  return row;
}

export async function listInbox(): Promise<InboxItem[]> {
  await io();
  return query<InboxItem>(
    `select ${columns} from inbox order by created_at desc limit 50`,
  );
}

/** The documents a reviewer has not answered for more than `hours`. */
export async function waitingSince(hours: number): Promise<InboxItem[]> {
  return query<InboxItem>(
    `select ${columns} from inbox where status = 'awaiting_review' and updated_at < now() - make_interval(hours => $1) order by updated_at`,
    [hours],
  );
}

type Patch = Partial<
  Pick<
    InboxItem,
    "status" | "type" | "data" | "confidence" | "review" | "requestId"
  >
>;
const columnOf: Record<keyof Patch, string> = {
  status: "status",
  type: "type",
  data: "data",
  confidence: "confidence",
  review: "review",
  requestId: "request_id",
};

/** Records a step's outcome on the item: the fields given, and when. */
export async function updateItem(id: string, patch: Patch): Promise<void> {
  const entries = Object.entries(patch) as [keyof Patch, unknown][];
  const sets = entries.map(([key], i) => `${columnOf[key]} = $${i + 2}`);
  await query(
    `update inbox set ${[...sets, "updated_at = now()"].join(", ")} where id = $1`,
    [id, ...entries.map(([, value]) => value)],
  );
}

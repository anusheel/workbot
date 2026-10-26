import { query } from "./db";
import { settings } from "./settings";

/**
 * Deletes what has outlived its window: traces, measurements, expired
 * sessions, the bytes of documents whose run has ended, spreadsheets,
 * conversations and the messages sent in them, expired link codes, the
 * chat bot's expired state, and chat replies kept for resuming.
 * Each deletion runs under the deployment's tenant, so it touches only its
 * own rows. Returns how many rows each step removed.
 */
export async function applyRetention(
  windows = settings.retention,
): Promise<Record<string, number>> {
  const counts = async (sql: string, params: unknown[] = []) =>
    (
      await query<{ n: number }>(
        `with gone as (${sql} returning 1) select count(*)::int as n from gone`,
        params,
      )
    )[0].n;
  return {
    traces: await counts(
      `delete from traces where at < now() - make_interval(days => $1)`,
      [windows.tracesDays],
    ),
    cacheReads: await counts(
      `delete from cache_reads where at < now() - make_interval(days => $1)`,
      [windows.measurementsDays],
    ),
    syncLog: await counts(
      `delete from sync_log where at < now() - make_interval(days => $1)`,
      [windows.measurementsDays],
    ),
    sessions: await counts(`delete from sessions where expires_at < now()`),
    // A filed or discarded document keeps its record on the request; its bytes go.
    documentBytes: await counts(
      `update inbox set bytes = ''::bytea
       where status in ('stored', 'rejected', 'expired', 'failed') and length(bytes) > 0
         and updated_at < now() - make_interval(days => $1)`,
      [windows.documentBytesDays],
    ),
    sheets: await counts(
      `delete from sheets where created_at < now() - make_interval(days => $1)`,
      [windows.sheetsDays],
    ),
    conversations: await counts(
      `delete from conversations where updated_at < now() - make_interval(days => $1)`,
      [windows.conversationsDays],
    ),
    outbound: await counts(
      `delete from outbound where created_at < now() - make_interval(days => $1)`,
      [windows.conversationsDays],
    ),
    expired:
      (await counts(`delete from link_codes where expires_at < now()`)) +
      (await counts(`delete from chat_state where expires_at < now()`)) +
      // A reply is resumed within minutes or not at all; its parts go after a day.
      (await counts(
        `delete from streams where created_at < now() - interval '1 day'`,
      )),
  };
}

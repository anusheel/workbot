import { query } from "./db";
import { settings } from "./settings";

/**
 * Deletes what has outlived its window: traces, measurements, expired
 * sessions, the bytes of documents whose run has ended, and spreadsheets.
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
  };
}

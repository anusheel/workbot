import { query } from "./db";
import { currentContext } from "./tracing";

export type Cached<T> = {
  value: T;
  fetchedAt: Date;
  outcome: "hit" | "stale" | "miss";
  /** The fetch replacing a stale value, for whoever wants to wait for it. */
  refresh?: Promise<void>;
};

/**
 * A read cached per tenant. Within its age it is a hit; past it, the stale
 * value is served while a fetch replaces it; absent, it is fetched first.
 * Every read's outcome and age are logged, so hit rate and staleness are
 * measured rather than assumed.
 */
export async function cached<T>(
  key: string,
  maxAgeMs: number,
  fetch: () => Promise<T>,
): Promise<Cached<T>> {
  const { tenant } = currentContext();
  const [row] = await query<{ value: T; fetchedAt: Date }>(
    `select value, fetched_at as "fetchedAt" from cache where tenant = $1 and key = $2`,
    [tenant, key],
  );
  const log = (outcome: Cached<T>["outcome"], ageMs: number) =>
    query(
      `insert into cache_reads (tenant, key, outcome, age_s) values ($1, $2, $3, $4)`,
      [tenant, key, outcome, Math.round(ageMs / 1000)],
    );
  const store = async () => {
    const value = await fetch();
    await query(
      `insert into cache (tenant, key, value) values ($1, $2, $3::jsonb)
       on conflict (tenant, key) do update set value = excluded.value, fetched_at = now()`,
      [tenant, key, JSON.stringify(value)],
    );
    return value;
  };
  if (!row) {
    const value = await store();
    await log("miss", 0);
    return { value, fetchedAt: new Date(), outcome: "miss" };
  }
  const age = Date.now() - row.fetchedAt.getTime();
  if (age <= maxAgeMs) {
    await log("hit", age);
    return { value: row.value, fetchedAt: row.fetchedAt, outcome: "hit" };
  }
  await log("stale", age);
  return {
    value: row.value,
    fetchedAt: row.fetchedAt,
    outcome: "stale",
    refresh: store().then(
      () => undefined,
      () => undefined,
    ),
  };
}

export type CacheSummary = {
  reads: number;
  hitRate: number | null;
  medianAgeS: number | null;
};

/** The last day of cached reads: how many, how often the value was there, how old what was served was. */
export async function cacheSummary(): Promise<CacheSummary> {
  const [row] = await query<{
    reads: number;
    hits: number;
    median: number | null;
  }>(
    `select count(*)::int as reads, count(*) filter (where outcome <> 'miss')::int as hits,
       percentile_cont(0.5) within group (order by age_s)::int as median
     from cache_reads where at > now() - interval '1 day'`,
  );
  return {
    reads: row.reads,
    hitRate: row.reads ? row.hits / row.reads : null,
    medianAgeS: row.median,
  };
}

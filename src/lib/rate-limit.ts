type Bucket = { tokens: number; at: number };

const buckets = new Map<string, Bucket>();

/**
 * A token bucket per key, in this process's memory: `limit` calls, refilled
 * evenly over `per` milliseconds. On a serverless platform each instance has
 * its own buckets, so the limit is per instance; a shared store would make
 * it global.
 */
export function allow(
  key: string,
  { limit = 20, per = 5 * 60_000, now = Date.now() } = {},
): boolean {
  // A bucket idle for a full window has refilled, so dropping it loses
  // nothing. Entries stay in order of last use, so the sweep stops early.
  for (const [k, b] of buckets) {
    if (now - b.at < per) break;
    buckets.delete(k);
  }
  const bucket = buckets.get(key) ?? { tokens: limit, at: now };
  const refilled = Math.min(
    limit,
    bucket.tokens + ((now - bucket.at) * limit) / per,
  );
  const allowed = refilled >= 1;
  buckets.delete(key);
  buckets.set(key, { tokens: allowed ? refilled - 1 : refilled, at: now });
  return allowed;
}

export function bucketCount(): number {
  return buckets.size;
}

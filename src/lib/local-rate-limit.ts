type Bucket = { timestamps: number[]; expiresAt: number };

type Options = {
  windowMs?: number;
  maxEntries?: number;
  now?: () => number;
};

/** Bounded, best-effort per-process admission control; not a distributed quota. */
export function createLocalRateLimiter({
  windowMs = 10 * 60 * 1000,
  maxEntries = 4096,
  now = () => performance.now(),
}: Options = {}) {
  if (
    !Number.isSafeInteger(windowMs) ||
    windowMs <= 0 ||
    !Number.isSafeInteger(maxEntries) ||
    maxEntries <= 0
  ) {
    throw new RangeError("Limiter window and capacity must be positive safe integers.");
  }
  // Successful admissions reorder entries by their last accepted timestamp.
  // With a nondecreasing clock, expiry order is therefore also Map order.
  const buckets = new Map<string, Bucket>();
  let lastTime = -Infinity;

  return {
    get size() {
      return buckets.size;
    },
    allow(key: string, limit: number): boolean {
      // Normal IP + action identifiers fit comfortably; bound retained key size.
      if (!key || key.length > 128 || !Number.isSafeInteger(limit) || limit <= 0) return false;
      const sampled = now();
      if (!Number.isFinite(sampled)) return false;
      const time = Math.max(lastTime, sampled);
      if (!Number.isFinite(time + windowMs)) return false;
      lastTime = time;

      for (const [identity, bucket] of buckets) {
        if (bucket.expiresAt > time) break;
        buckets.delete(identity);
      }

      const bucket = buckets.get(key);
      // Never evict an active identity to admit another one: that resets quotas.
      if (!bucket && buckets.size >= maxEntries) return false;
      const recent = bucket?.timestamps.filter((stamp) => stamp > time - windowMs) ?? [];
      if (recent.length >= limit) {
        if (bucket) bucket.timestamps = recent;
        // Rejections neither extend expiry nor change expiry ordering.
        return false;
      }
      recent.push(time);
      buckets.delete(key);
      buckets.set(key, { timestamps: recent, expiresAt: time + windowMs });
      return true;
    },
  };
}

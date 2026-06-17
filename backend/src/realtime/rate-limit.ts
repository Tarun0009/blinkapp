type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the event is allowed, false if it should be dropped.
 * Counter is per-(user, event) within a rolling window.
 */
export function allowSocketEvent(
  userId: string,
  event: string,
  { limit, windowMs }: { limit: number; windowMs: number },
) {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

/**
 * Periodically prune expired buckets so the map does not grow unbounded.
 */
setInterval(() => {
  const now = Date.now();
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });
}, 60_000).unref?.();

export const SOCKET_LIMITS = {
  typing: { limit: 60, windowMs: 60_000 },
  chatJoin: { limit: 120, windowMs: 60_000 },
  // Loose default for any other event.
  default: { limit: 240, windowMs: 60_000 },
} as const;

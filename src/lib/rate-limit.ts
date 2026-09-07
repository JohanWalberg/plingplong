/**
 * Small in-memory rate limiter (sliding window per key). Good for one web
 * instance; swap the store for Postgres or Redis when running several.
 */
type Entry = { hits: number[]; windowMs: number };

/**
 * Bounded so the store cannot grow with traffic. The metrics endpoint keys on
 * (visitor, listing, day), which is one entry per home someone looks at, so an
 * unbounded map would hold a day of that in the web process.
 */
const MAX_ENTRIES = 20_000;
const store = new Map<string, Entry>();
let lastSweep = Date.now();

/** Limits are on in production, or anywhere with RATE_LIMIT=on (used to verify them locally). */
export const RATE_LIMIT_ENABLED = process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "on";

export type LimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number };

/**
 * Drops entries whose own window has passed. It has to be each entry's window,
 * not the caller's: the metrics route runs a 60-second per-address limit before
 * its 24-hour once-per-visitor-per-home check, and sweeping the second by the
 * first's window silently shortened the daily count to about a minute.
 */
function sweep(now: number) {
  for (const [k, e] of store) if (!e.hits.some((t) => now - t < e.windowMs)) store.delete(k);
  lastSweep = now;
}

export function rateLimit(key: string, max: number, windowSeconds: number, now = Date.now()): LimitResult {
  if (!RATE_LIMIT_ENABLED && process.env.NODE_ENV !== "test") return { ok: true, remaining: max };
  if (now - lastSweep > 60_000) sweep(now);
  const windowMs = windowSeconds * 1000;
  const entry = store.get(key) ?? { hits: [], windowMs };
  entry.windowMs = windowMs;
  entry.hits = entry.hits.filter((t) => now - t < windowMs);
  if (entry.hits.length >= max) {
    const retryAfterSeconds = Math.ceil((entry.hits[0] + windowMs - now) / 1000);
    store.set(key, entry);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }
  entry.hits.push(now);
  // Re-insert so the Map keeps insertion order as recency, then evict the oldest.
  store.delete(key);
  store.set(key, entry);
  if (store.size > MAX_ENTRIES) {
    sweep(now);
    while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
  }
  return { ok: true, remaining: max - entry.hits.length };
}

/**
 * The client address as the first trusted proxy saw it. Proxies append to
 * X-Forwarded-For, so with N trusted hops the client is the N-th entry from
 * the right; anything further left was supplied by the client and is ignored.
 * TRUSTED_PROXY_HOPS defaults to 1 (one load balancer or CDN in front).
 */
export function clientIp(headers: Headers): string {
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS ?? 1) || 1);
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[Math.max(0, parts.length - hops)];
  }
  return headers.get("x-real-ip") ?? "local";
}

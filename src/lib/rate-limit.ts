/**
 * Small in-memory rate limiter (sliding window per key). Good for one web
 * instance; swap the store for Postgres or Redis when running several.
 */
type Entry = { hits: number[]; };
const store = new Map<string, Entry>();
let lastSweep = Date.now();

/** Limits are on in production, or anywhere with RATE_LIMIT=on (used to verify them locally). */
export const RATE_LIMIT_ENABLED = process.env.NODE_ENV === "production" || process.env.RATE_LIMIT === "on";

export type LimitResult = { ok: true; remaining: number } | { ok: false; retryAfterSeconds: number };

export function rateLimit(key: string, max: number, windowSeconds: number, now = Date.now()): LimitResult {
  if (!RATE_LIMIT_ENABLED && process.env.NODE_ENV !== "test") return { ok: true, remaining: max };
  if (now - lastSweep > 60_000) {
    for (const [k, e] of store) if (!e.hits.some((t) => now - t < windowSeconds * 1000)) store.delete(k);
    lastSweep = now;
  }
  const windowMs = windowSeconds * 1000;
  const entry = store.get(key) ?? { hits: [] };
  entry.hits = entry.hits.filter((t) => now - t < windowMs);
  if (entry.hits.length >= max) {
    const retryAfterSeconds = Math.ceil((entry.hits[0] + windowMs - now) / 1000);
    store.set(key, entry);
    return { ok: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }
  entry.hits.push(now);
  store.set(key, entry);
  return { ok: true, remaining: max - entry.hits.length };
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "local";
}

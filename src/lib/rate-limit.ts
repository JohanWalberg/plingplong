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

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
 * Where the proxy puts the address it resolved, for code that must not repeat
 * the guesswork — Better Auth reads only this. Anything arriving under this name
 * from outside is overwritten in src/proxy.ts before it can be believed.
 */
export const CLIENT_IP_HEADER = "x-hb-client-ip";

/**
 * The client address as the first trusted proxy saw it. Proxies append to
 * X-Forwarded-For, so with N trusted hops the client is the N-th entry from
 * the right; anything further left was supplied by the client and is ignored.
 * TRUSTED_PROXY_HOPS says how many: 1 for a single load balancer or CDN
 * (Fly, Vercel), 2 where a CDN sits in front of the platform's own balancer
 * (Render puts Cloudflare ahead of every service), 0 when the server is
 * reached directly. It defaults to 1, and anything unparseable is read as 0 so
 * a typo fails closed. /api/whoami shows what the running server resolves.
 */
export function clientIp(headers: Headers): string {
  // 0 means nothing trustworthy sits in front, so the forwarded headers are the
  // caller's own writing and believing them hands out a fresh bucket per
  // request. One shared bucket is the honest answer there; the number has to be
  // declared in production (see lib/env-check.ts) so it is never a guess.
  const hops = Math.max(0, Math.trunc(Number(process.env.TRUSTED_PROXY_HOPS ?? 1)) || 0);
  if (hops === 0) return "unproxied";
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[Math.max(0, parts.length - hops)];
  }
  return headers.get("x-real-ip") ?? "local";
}

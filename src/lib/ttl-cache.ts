/**
 * Small in-process memo for read queries: results live for a short TTL,
 * identical concurrent calls share one promise, and a namespace can be
 * cleared when the web process changes the data itself (portal and admin
 * actions). Crawl changes land through the TTL, which is well below the
 * hourly fetch cadence. Values are kept as returned, so Dates stay Dates.
 *
 * Per process by design: it removes repeated database round trips on the
 * busiest pages without a shared cache service. Set CACHE_TTL_SECONDS=0 to
 * disable (tests do).
 */
/** Namespace for the public listing queries; cleared by invalidateListingCaches(). */
export const LISTINGS_NS = "listings";

type Entry = { value: Promise<unknown>; expires: number };
type Store = Map<string, Entry>;

const g = globalThis as unknown as { __hyrabostadCache?: Map<string, Store> };
const stores = (g.__hyrabostadCache ??= new Map<string, Store>());

const DEFAULT_TTL_MS = (() => {
  const v = process.env.CACHE_TTL_SECONDS;
  if (v === undefined || v === "") return 60_000;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n * 1000 : 60_000;
})();

let memoSeq = 0;

export function memoize<A extends unknown[], R>(ns: string, fn: (...args: A) => Promise<R>, { ttlMs = DEFAULT_TTL_MS, max = 500, now = Date.now }: { ttlMs?: number; max?: number; now?: () => number } = {}) {
  if (ttlMs <= 0) return fn;
  let store = stores.get(ns);
  if (!store) stores.set(ns, (store = new Map()));
  const s = store;
  // Each memoized function gets its own key prefix: two functions in one
  // namespace called with equal arguments must never share an entry.
  const id = `${fn.name || "fn"}#${memoSeq++}:`;
  return async (...args: A): Promise<R> => {
    const key = id + JSON.stringify(args);
    const hit = s.get(key);
    const t = now();
    if (hit && hit.expires > t) return hit.value as Promise<R>;
    const value = fn(...args);
    s.delete(key); // re-insert so the Map keeps insertion order as recency
    s.set(key, { value, expires: t + ttlMs });
    value.catch(() => s.delete(key)); // never cache a failure
    while (s.size > max) s.delete(s.keys().next().value!);
    return value;
  };
}

/** Drop everything cached under a namespace. */
export function invalidate(ns: string) {
  stores.get(ns)?.clear();
}

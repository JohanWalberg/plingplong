/**
 * Recently viewed homes, kept in the visitor's browser only. A small snapshot
 * of each card is stored at view time so the row renders on static pages
 * without a request; the listing page itself is always the source of truth.
 */
export const RECENT_KEY = "hyrabostad:recent";
export const MAX_RECENT = 12;

export type RecentHome = {
  slug: string;
  address: string;
  place: string;
  rentMonthly: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  imageUrl: string | null;
  landlordName: string;
  viewedAt: string;
};

export function readRecent(): RecentHome[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((r) => r && typeof r.slug === "string") : [];
  } catch {
    return [];
  }
}

export function recordRecent(home: Omit<RecentHome, "viewedAt">) {
  try {
    const rest = readRecent().filter((r) => r.slug !== home.slug);
    localStorage.setItem(RECENT_KEY, JSON.stringify([{ ...home, viewedAt: new Date().toISOString() }, ...rest].slice(0, MAX_RECENT)));
  } catch {
    // storage unavailable: nothing to remember
  }
}

export function clearRecent() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // ignore
  }
}

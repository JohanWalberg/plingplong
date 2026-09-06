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
    if (!Array.isArray(arr)) return [];
    // Storage is writable by any same-origin script: keep only well-formed rows with image URLs we would render.
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return arr
      .filter((r) => r && typeof r.slug === "string" && /^[a-z0-9-]+$/.test(r.slug) && typeof r.address === "string")
      .map((r) => ({
        slug: r.slug,
        address: String(r.address),
        place: typeof r.place === "string" ? r.place : "",
        rentMonthly: num(r.rentMonthly),
        rooms: num(r.rooms),
        sizeSqm: num(r.sizeSqm),
        imageUrl: typeof r.imageUrl === "string" && (r.imageUrl.startsWith("/api/uploads/") || r.imageUrl.startsWith("https://")) ? r.imageUrl : null,
        landlordName: typeof r.landlordName === "string" ? r.landlordName : "",
        viewedAt: typeof r.viewedAt === "string" ? r.viewedAt : "",
      }));
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

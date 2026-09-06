/**
 * Saved homes live in the visitor's browser only: a cookie (so the server can
 * render the saved page) mirrored to localStorage. No account, no server state.
 */
export const SAVED_COOKIE = "hb_saved";
export const SAVED_SEARCHES_KEY = "hyrabostad:saved-searches";
const MAX_SAVED = 60;

export function parseSavedCookie(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const arr = JSON.parse(decodeURIComponent(value));
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, MAX_SAVED) : [];
  } catch {
    return [];
  }
}

export function readSavedClient(): string[] {
  if (typeof document === "undefined") return [];
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${SAVED_COOKIE}=`));
  return parseSavedCookie(m?.slice(SAVED_COOKIE.length + 1));
}

export function writeSavedClient(slugs: string[]) {
  const value = encodeURIComponent(JSON.stringify(slugs.slice(0, MAX_SAVED)));
  document.cookie = `${SAVED_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
  try {
    localStorage.setItem(SAVED_COOKIE, JSON.stringify(slugs));
  } catch {
    // storage may be unavailable; the cookie is the source of truth
  }
}

export type SavedSearch = { label: string; href: string; savedAt: string };

export function readSavedSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(SAVED_SEARCHES_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    // Storage is writable by any same-origin script: only accept the shape we wrote, with an in-site href.
    return Array.isArray(arr)
      ? arr.filter((x): x is SavedSearch => x && typeof x.label === "string" && typeof x.href === "string" && x.href.startsWith("/") && !x.href.startsWith("//") && typeof x.savedAt === "string")
      : [];
  } catch {
    return [];
  }
}

export function writeSavedSearches(list: SavedSearch[]) {
  try {
    localStorage.setItem(SAVED_SEARCHES_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // ignore
  }
}

/**
 * Duplicate detection. Blocking: municipality + rounded rent + rooms. Scoring:
 * normalised address (Levenshtein on street + number), size ±2 m², distance,
 * and landlord identity. Above AUTO_MERGE with the same landlord → merge;
 * REVIEW_MIN..AUTO_MERGE → duplicate_candidate for staff; below → ignore.
 * Never auto-merge across different landlords.
 */
export const AUTO_MERGE = 0.92;
export const REVIEW_MIN = 0.5;

export type DedupSubject = {
  id: string;
  landlordId: string;
  municipalityId: string;
  address: string;
  rentMonthly: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  lat: number | null;
  lon: number | null;
};

export function normaliseAddress(a: string): string {
  return a
    .toLowerCase()
    .replace(/,.*$/, "") // drop apartment info after a comma
    .replace(/\b(lgh|lägenhet|apartment|apt|uppgång|tr|trappor)\b.*$/g, "")
    .replace(/\bgatan\b/g, "g")
    .replace(/\bvägen\b/g, "v")
    .replace(/[^a-z0-9åäö ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

export function addressSimilarity(a: string, b: string): number {
  const x = normaliseAddress(a);
  const y = normaliseAddress(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const d = levenshtein(x, y);
  return Math.max(0, 1 - d / Math.max(x.length, y.length));
}

export function distanceMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Blocking key: same municipality, rent bucket (500 kr) and rooms. Null rent/rooms block on "unknown". */
export function blockKey(s: Pick<DedupSubject, "municipalityId" | "rentMonthly" | "rooms">): string {
  const rent = s.rentMonthly === null ? "r?" : `r${Math.round(s.rentMonthly / 500)}`;
  const rooms = s.rooms === null ? "k?" : `k${Math.floor(s.rooms)}`;
  return `${s.municipalityId}|${rent}|${rooms}`;
}

export type DedupScore = { score: number; features: Record<string, number | boolean | null> };

export function scorePair(a: DedupSubject, b: DedupSubject): DedupScore {
  const address = addressSimilarity(a.address, b.address);
  const rent = a.rentMonthly !== null && b.rentMonthly !== null ? (a.rentMonthly === b.rentMonthly ? 1 : Math.max(0, 1 - Math.abs(a.rentMonthly - b.rentMonthly) / 1000)) : 0.5;
  const rooms = a.rooms !== null && b.rooms !== null ? (a.rooms === b.rooms ? 1 : 0) : 0.5;
  const size = a.sizeSqm !== null && b.sizeSqm !== null ? (Math.abs(a.sizeSqm - b.sizeSqm) <= 2 ? 1 : Math.max(0, 1 - Math.abs(a.sizeSqm - b.sizeSqm) / 20)) : 0.5;
  const dist = a.lat !== null && a.lon !== null && b.lat !== null && b.lon !== null ? distanceMeters(a.lat, a.lon, b.lat, b.lon) : null;
  const geo = dist === null ? 0.5 : dist < 50 ? 1 : dist < 300 ? 0.7 : dist < 1000 ? 0.3 : 0;
  const sameLandlord = a.landlordId === b.landlordId;
  // Address dominates; the rest confirms.
  let score = address * 0.5 + rent * 0.15 + rooms * 0.1 + size * 0.15 + geo * 0.1;
  // A clearly different street is never a duplicate, whatever the numbers say.
  if (address < 0.6) score = Math.min(score, 0.45);
  return { score: Math.round(score * 1000) / 1000, features: { address: Math.round(address * 100) / 100, rent, rooms, size, distanceM: dist === null ? null : Math.round(dist), sameLandlord } };
}

export function decide(s: DedupScore, sameLandlord: boolean): "merge" | "review" | "ignore" {
  if (s.score >= AUTO_MERGE && sameLandlord) return "merge";
  if (s.score >= REVIEW_MIN) return "review";
  return "ignore";
}

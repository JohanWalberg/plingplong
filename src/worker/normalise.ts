import type { RawListing } from "./adapters/types";
import { safeHttpUrl } from "@/lib/safe-url";

export type NormalisedListing = {
  externalId: string;
  sourceUrl: string | null;
  address: string;
  areaName: string | null;
  municipalityName: string | null;
  postcode: string | null;
  rentMonthly: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  floor: number | null;
  floorsTotal: number | null;
  moveInDate: string | null;
  applicationDeadline: string | null;
  queueRequirement: "none" | "queue" | "points" | "unknown";
  segment: "none" | "student" | "youth" | "senior" | "accessible";
  contractType: "first_hand" | "sublet";
  description: string | null;
  imageUrl: string | null;
  lat: number | null;
  lon: number | null;
  raw: unknown;
};

/** "9 340 kr/mån" → 9340; "9.340,00" → 9340; "12450" → 12450; nonsense → null. */
export function parseMoney(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const cleaned = v.replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  // Remove thousands separators (dots/commas followed by exactly three digits) then decimals.
  const noThousands = cleaned.replace(/[.,](?=\d{3}(\D|$))/g, "");
  const n = parseFloat(noThousands.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** "2 rok" → 2; "2,5 rum" → 2.5; "3" → 3 */
export function parseRooms(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v > 0 && v < 30 ? v : null;
  const m = v.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 0 && n < 30 ? n : null;
}

/** "54 m²" → 54; "54,5 kvm" → 54.5 */
export function parseSize(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v > 0 && v < 1000 ? v : null;
  const m = v.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n > 0 && n < 1000 ? n : null;
}

export function parseInteger(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isInteger(v) ? v : Math.round(v);
  const m = v.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : null;
}

const SV_MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
const EN_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** ISO dates, "8/9 2026", "8 september 2026", "2026-09-08T10:00:00Z" → "YYYY-MM-DD". Unknown → null. */
export function parseDate(v: string | null | undefined, now: Date = new Date()): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./ ](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\s+([a-zåäö]+)\.?\s*(\d{4})?$/);
  if (m) {
    const idx = SV_MONTHS.findIndex((x) => x.startsWith(m![2].slice(0, 3))) >= 0 ? SV_MONTHS.findIndex((x) => x.startsWith(m![2].slice(0, 3))) : EN_MONTHS.findIndex((x) => x.startsWith(m![2].slice(0, 3)));
    if (idx >= 0) {
      const year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
      return `${year}-${String(idx + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  if (/omg[åa]ende|snarast|enligt [öo]verenskommelse|immediately|asap/.test(s)) return null;
  return null;
}

export function parseQueue(v: string | null | undefined): NormalisedListing["queueRequirement"] {
  if (!v) return "unknown";
  const s = v.toLowerCase();
  if (/ingen k[öo]|no queue|utan k[öo]|none|ingen/.test(s)) return "none";
  if (/po[äa]ng|points/.test(s)) return "points";
  if (/k[öo]|queue|k[öo]tid|waiting/.test(s)) return "queue";
  return "unknown";
}

export function parseSegment(v: string | null | undefined): NormalisedListing["segment"] {
  if (!v) return "none";
  const s = v.toLowerCase();
  if (/student/.test(s)) return "student";
  if (/ungdom|youth/.test(s)) return "youth";
  if (/senior|55\+|65\+|trygghet/.test(s)) return "senior";
  if (/tillg[äa]nglig|accessible|handikapp|rullstol/.test(s)) return "accessible";
  return "none";
}

export function parseContract(v: string | null | undefined): NormalisedListing["contractType"] {
  if (!v) return "first_hand";
  return /andra ?hand|sublet|second[- ]hand/i.test(v) ? "sublet" : "first_hand";
}

export function normalisePostcode(v: string | undefined): string | null {
  if (!v) return null;
  const digits = v.replace(/\D/g, "");
  return digits.length === 5 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : null;
}

/** Trim descriptions: we store a short factual excerpt, never the full marketing text. */
export function excerpt(v: string | null | undefined, max = 600): string | null {
  if (!v) return null;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function normalise(raw: RawListing, now: Date = new Date(), base?: string): NormalisedListing {
  return {
    externalId: raw.externalId.trim(),
    sourceUrl: safeHttpUrl(raw.url, base),
    address: raw.address!.replace(/\s+/g, " ").trim(),
    areaName: raw.area?.trim() || null,
    municipalityName: raw.municipality?.trim() || null,
    postcode: normalisePostcode(raw.postcode),
    rentMonthly: parseMoney(raw.rent),
    rooms: parseRooms(raw.rooms),
    sizeSqm: parseSize(raw.size),
    floor: parseInteger(raw.floor),
    floorsTotal: parseInteger(raw.floorsTotal),
    moveInDate: parseDate(raw.moveIn, now),
    applicationDeadline: parseDate(raw.deadline, now),
    queueRequirement: parseQueue(raw.queue),
    segment: parseSegment(raw.segment),
    contractType: parseContract(raw.contract),
    description: excerpt(raw.description),
    imageUrl: safeHttpUrl(raw.image, base),
    lat: typeof raw.lat === "number" && Math.abs(raw.lat) <= 90 ? raw.lat : null,
    lon: typeof raw.lon === "number" && Math.abs(raw.lon) <= 180 ? raw.lon : null,
    raw: raw.raw,
  };
}

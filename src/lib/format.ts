import type { Locale } from "@/i18n/routing";
import { intlLocale } from "./locale";

/**
 * Locale-aware formatters. Rent, rooms and size are never assembled by hand
 * outside this file: the difference between "9 340 kr/mån" and
 * "SEK 9,340/month" is a formatter difference, not a string difference.
 */

export function formatNumber(locale: Locale, n: number, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0, ...opts }).format(n);
}

/** "9 340 kr" / "SEK 9,340" */
export function formatSek(locale: Locale, n: number) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
    currencyDisplay: locale === "sv" ? "symbol" : "code",
  }).format(n);
}

/** "9 340 kr/mån" / "SEK 9,340/month" */
export function formatRent(locale: Locale, n: number) {
  return locale === "sv" ? `${formatSek(locale, n)}/mån` : `${formatSek(locale, n)}/month`;
}

/** "2 rum" / "2 rooms", "1 rum" / "1 room", "2,5 rum" / "2.5 rooms" */
export function formatRooms(locale: Locale, rooms: number) {
  const n = formatNumber(locale, rooms, { maximumFractionDigits: 1 });
  if (locale === "sv") return `${n} rum`;
  return rooms === 1 ? `${n} room` : `${n} rooms`;
}

/** "54 m²" */
export function formatSize(locale: Locale, sqm: number) {
  return `${formatNumber(locale, sqm)} m²`;
}

/** "8 sep" / "8 Sep" — for badges and table cells. */
export function formatDateShort(locale: Locale, d: Date | string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short", timeZone: "Europe/Stockholm" }).format(toDate(d));
}

/** "8 september 2026" / "8 September 2026" */
export function formatDateLong(locale: Locale, d: Date | string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Stockholm" }).format(toDate(d));
}

/** "2 september 2026, 09:12" */
export function formatDateTime(locale: Locale, d: Date | string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  }).format(toDate(d));
}

/** "14:41" */
export function formatTime(locale: Locale, d: Date | string) {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" }).format(toDate(d));
}

/** "1 sep 09:14" / "1 Sep 09:14" */
export function formatDateTimeShort(locale: Locale, d: Date | string) {
  return `${formatDateShort(locale, d)} ${formatTime(locale, d)}`;
}

/** "15,7 %" / "15.7%" */
export function formatPercent(locale: Locale, ratio: number, digits = 1) {
  return new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: digits }).format(ratio);
}

export function toDate(d: Date | string): Date {
  if (d instanceof Date) return d;
  // Date-only strings are calendar dates in Stockholm; parse as local noon to avoid DST edges.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(`${d}T12:00:00+02:00`);
  return new Date(d);
}

/** Calendar date (YYYY-MM-DD) in Stockholm time for a given instant. */
/** The instant Stockholm's calendar day began for `d`, on any server time zone and across DST. */
export function stockholmDayStart(d: Date = new Date()): Date {
  const ymd = stockholmDate(d);
  const guess = new Date(`${ymd}T00:00:00Z`);
  const offsetText = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Stockholm", timeZoneName: "longOffset" }).formatToParts(guess).find((p) => p.type === "timeZoneName")?.value ?? "GMT+01:00";
  const m = /([+-])(\d{2}):(\d{2})/.exec(offsetText);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 60;
  return new Date(guess.getTime() - offsetMin * 60_000);
}

export function stockholmDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Whole calendar days from today (Stockholm) to a YYYY-MM-DD date. Negative when past. */
export function daysUntil(date: string, now: Date = new Date()): number {
  const today = stockholmDate(now);
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

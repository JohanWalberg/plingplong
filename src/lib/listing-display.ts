import type { Locale } from "@/i18n/routing";
import type { QueueRequirement, Segment } from "@/db/schema";
import { daysUntil, formatDateShort, formatRent, formatRooms, formatSize, formatTime } from "./format";

export type BadgeTone = "urgent" | "soon" | "neutral" | "info" | "quiet";
export type Badge = { key: string; tone: BadgeTone; icon?: "warn" | "clock" | "question"; label: string };

export type DeadlineState =
  | { kind: "rolling"; tone: "quiet" }
  | { kind: "closed"; tone: "quiet"; days: number }
  | { kind: "today"; tone: "urgent"; days: 0 }
  | { kind: "tomorrow"; tone: "soon"; days: 1 }
  | { kind: "soon"; tone: "soon"; days: number }
  | { kind: "by"; tone: "neutral"; days: number };

/**
 * Deadline state. "Closing soon" covers tomorrow and the day after (48h),
 * per the badge spec on the Foundations screen. Past deadlines are "closed",
 * never "today".
 */
export function deadlineState(deadline: string | null, now: Date = new Date()): DeadlineState {
  if (!deadline) return { kind: "rolling", tone: "quiet" };
  const days = daysUntil(deadline, now);
  if (days < 0) return { kind: "closed", tone: "quiet", days };
  if (days === 0) return { kind: "today", tone: "urgent", days: 0 };
  if (days === 1) return { kind: "tomorrow", tone: "soon", days: 1 };
  if (days === 2) return { kind: "soon", tone: "soon", days };
  return { kind: "by", tone: "neutral", days };
}

/** Interpolation values as next-intl expects them; each message key uses a subset. */
type MessageValues = Record<string, string | number>;
const values = (v: MessageValues): MessageValues => v;

/** Message key + values for a deadline state; rendered via t("deadline.*"). */
export function deadlineMessage(locale: Locale, deadline: string | null, now: Date = new Date()) {
  const s = deadlineState(deadline, now);
  switch (s.kind) {
    case "rolling":
      return { key: "rolling" as const, values: values({}) };
    case "closed":
      return { key: "closed" as const, values: values({}) };
    case "today":
      return { key: "today" as const, values: values({}) };
    case "tomorrow":
      return { key: "tomorrow" as const, values: values({}) };
    default:
      // Inside two weeks a count reads faster than a date; beyond that the date is what people plan around.
      if (s.days <= 14) return { key: "closesIn" as const, values: values({ count: s.days }) };
      return { key: "by" as const, values: values({ date: formatDateShort(locale, deadline!) }) };
  }
}

/** Freshness copy: which key and which values, from `last_checked_at`. */
export function freshnessMessage(locale: Locale, lastCheckedAt: Date | null, now: Date = new Date()) {
  if (!lastCheckedAt) return { key: "never" as const, values: values({}) };
  const minutes = Math.max(0, Math.round((now.getTime() - lastCheckedAt.getTime()) / 60_000));
  if (minutes <= 3) return { key: "justNow" as const, values: values({}) };
  if (minutes < 60) return { key: "minutesAgo" as const, values: values({ count: minutes }) };
  const sameDay =
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(now) ===
    new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(lastCheckedAt);
  if (sameDay) return { key: "todayAt" as const, values: values({ time: formatTime(locale, lastCheckedAt) }) };
  const days = Math.round(minutes / 1440);
  if (days <= 1) return { key: "yesterday" as const, values: values({}) };
  return { key: "daysAgo" as const, values: values({ count: days }) };
}

export type ListingForBadges = {
  applicationDeadline: string | null;
  queueRequirement: QueueRequirement;
  contractType: "first_hand" | "sublet";
  segment: Segment;
  firstSeenAt: Date;
  publishedDirectly: boolean;
};

export type BadgeLabels = {
  closingToday: string;
  closing: string;
  noQueue: string;
  queue: string;
  points: string;
  unknownQueue: string;
  first: string;
  sublet: string;
  student: string;
  youth: string;
  senior: string;
  accessible: string;
  new: string;
  direct: string;
};

/**
 * Badge composition per the design's priority rule:
 * deadline state outranks everything, then queue requirement, then contract
 * type, then segment. "New" is lowest and only shown when there is room.
 * "Published by landlord" (direct) is treated like a segment-level badge.
 * Never more than `limit` badges; the unknown-queue badge is never hidden
 * by anything below it.
 */
export function composeBadges(l: ListingForBadges, labels: BadgeLabels, limit = 3, now: Date = new Date()): Badge[] {
  const out: Badge[] = [];
  const d = deadlineState(l.applicationDeadline, now);
  if (d.kind === "today") out.push({ key: "closingToday", tone: "urgent", icon: "warn", label: labels.closingToday });
  else if (d.kind === "tomorrow" || d.kind === "soon") out.push({ key: "closing", tone: "soon", icon: "clock", label: labels.closing });

  switch (l.queueRequirement) {
    case "none":
      out.push({ key: "noQueue", tone: "info", label: labels.noQueue });
      break;
    case "points":
      out.push({ key: "points", tone: "neutral", label: labels.points });
      break;
    case "queue":
      out.push({ key: "queue", tone: "neutral", label: labels.queue });
      break;
    default:
      out.push({ key: "unknownQueue", tone: "quiet", icon: "question", label: labels.unknownQueue });
  }

  out.push(
    l.contractType === "sublet"
      ? { key: "sublet", tone: "quiet", label: labels.sublet }
      : { key: "first", tone: "neutral", label: labels.first },
  );

  if (l.segment !== "none") out.push({ key: l.segment, tone: "quiet", label: labels[l.segment] });
  if (l.publishedDirectly) out.push({ key: "direct", tone: "info", label: labels.direct });

  const isNew = now.getTime() - l.firstSeenAt.getTime() < 24 * 60 * 60_000;
  if (isNew && out.length < limit) out.push({ key: "new", tone: "info", label: labels.new });

  return out.slice(0, limit);
}

export function rentLabel(locale: Locale, rent: number | null, unknown: string) {
  return rent === null ? unknown : formatRent(locale, rent);
}

export function roomsSizeLabel(
  locale: Locale,
  rooms: number | null,
  size: number | null,
  labels: { roomsUnknown: string; sizeUnknown: string },
) {
  const r = rooms === null ? labels.roomsUnknown : formatRooms(locale, rooms);
  const s = size === null ? labels.sizeUnknown : formatSize(locale, size);
  return `${r} · ${s}`;
}

export function initials(name: string) {
  const stop = new Set(["ab", "i", "och", "bostads", "fastighets", "fastighet", "aktiebolag", "hb", "kb", "brf"]);
  const words = name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !stop.has(w.toLowerCase()));
  const base = words.length ? words : name.split(/\s+/);
  return base
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
}

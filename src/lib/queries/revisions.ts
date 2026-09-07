/**
 * Which listing columns produce a revision row when they change, keyed by the
 * Drizzle property name with the column name as value (revisions store the
 * column name so the history reads the same across crawl, portal and admin).
 */
export const LISTING_TRACKED = {
  rentMonthly: "rent_monthly",
  rooms: "rooms",
  sizeSqm: "size_sqm",
  applicationDeadline: "application_deadline",
  moveInDate: "move_in_date",
  address: "address",
  queueRequirement: "queue_requirement",
} as const;

/** Staff can also correct these; the crawler and the portal form never touch them. */
export const LISTING_TRACKED_ADMIN = {
  ...LISTING_TRACKED,
  areaName: "area_name",
  floor: "floor",
  segment: "segment",
  applicationUrl: "application_url",
  description: "description",
} as const;

export type RevisionChange = { field: string; oldValue: string | null; newValue: string | null };

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

/** Compares `before` and `after` on the tracked keys; null and undefined count as the same empty value. */
export function diffTracked<F extends Record<string, string>>(fields: F, before: { [K in keyof F]?: unknown }, after: { [K in keyof F]?: unknown }): RevisionChange[] {
  const out: RevisionChange[] = [];
  for (const key of Object.keys(fields) as Array<keyof F>) {
    const a = str(before[key]);
    const b = str(after[key]);
    if (a !== b) out.push({ field: fields[key], oldValue: a, newValue: b });
  }
  return out;
}

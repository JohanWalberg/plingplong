
export const SORTS = ["new", "rentUp", "rentDown", "sizeDown", "deadline", "checked"] as const;
export type Sort = (typeof SORTS)[number];
export const QUEUE_FILTERS = ["none", "queue", "unknown"] as const;
export type QueueFilter = (typeof QUEUE_FILTERS)[number];
export const SEGMENT_FILTERS = ["student", "youth", "senior", "accessible"] as const;
export type SegmentFilter = (typeof SEGMENT_FILTERS)[number];

export const RENT_MIN = 4000;
export const RENT_MAX = 25000; // = no limit
export const RENT_STEP = 500;
export const PAGE_SIZE = 20;

/**
 * Parsed search state. The zod schema that produces it lives in
 * search-params-parse.ts so the filter panel (a client component) can use the
 * constants and helpers here without shipping zod to the browser.
 */
export type SearchFilters = {
  maxRent?: number;
  rooms: number[];
  sizeMin?: number;
  sizeMax?: number;
  queue: QueueFilter[];
  landlord: string[];
  segment: SegmentFilter[];
  moveInBefore?: string;
  sort: Sort;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** Serialise filters back to a query object, omitting defaults so URLs stay short. */
export function toQuery(f: Partial<SearchFilters>): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.maxRent && f.maxRent < RENT_MAX) q.maxRent = String(f.maxRent);
  if (f.rooms?.length) q.rooms = [...f.rooms].sort().join(",");
  if (f.sizeMin) q.sizeMin = String(f.sizeMin);
  if (f.sizeMax) q.sizeMax = String(f.sizeMax);
  if (f.queue?.length) q.queue = f.queue.join(",");
  if (f.landlord?.length) q.landlord = f.landlord.join(",");
  if (f.segment?.length) q.segment = f.segment.join(",");
  if (f.moveInBefore) q.moveInBefore = f.moveInBefore;
  if (f.sort && f.sort !== "new") q.sort = f.sort;
  if (f.page && f.page > 1) q.page = String(f.page);
  return q;
}

export function activeFilterCount(f: SearchFilters): number {
  let n = 0;
  if (f.maxRent && f.maxRent < RENT_MAX) n++;
  n += f.rooms.length;
  if (f.sizeMin || f.sizeMax) n++;
  n += f.queue.length;
  n += f.landlord.length;
  n += f.segment.length;
  if (f.moveInBefore) n++;
  return n;
}

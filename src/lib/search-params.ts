import { z } from "zod";

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

const intList = (max: number) =>
  z
    .preprocess(
      (v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []),
      z.array(z.coerce.number().int().min(1).max(max)),
    )
    .default([]);

const strList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []), z.array(z.enum(values)))
    .default([]);

export const searchParamsSchema = z.object({
  maxRent: z.coerce.number().int().min(RENT_MIN).max(RENT_MAX).optional().catch(undefined),
  rooms: intList(4).catch([]),
  sizeMin: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
  sizeMax: z.coerce.number().int().min(1).max(999).optional().catch(undefined),
  queue: strList(QUEUE_FILTERS).catch([]),
  landlord: z
    .preprocess((v) => (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : []), z.array(z.string().min(1).max(80)))
    .default([])
    .catch([]),
  segment: strList(SEGMENT_FILTERS).catch([]),
  moveInBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  sort: z.enum(SORTS).default("new").catch("new"),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});

export type SearchFilters = z.infer<typeof searchParamsSchema>;

export type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseSearchParams(raw: RawSearchParams): SearchFilters {
  return searchParamsSchema.parse(raw);
}

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

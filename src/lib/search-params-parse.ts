import { z } from "zod";
import { QUEUE_FILTERS, RENT_MAX, RENT_MIN, SEGMENT_FILTERS, SORTS, type RawSearchParams, type SearchFilters } from "./search-params";

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

/** Lenient: any invalid value falls back to its default instead of failing the page. Server only. */
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

export function parseSearchParams(raw: RawSearchParams): SearchFilters {
  return searchParamsSchema.parse(raw);
}

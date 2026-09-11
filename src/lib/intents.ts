import type { Locale } from "@/i18n/routing";
import type { SearchFilters } from "./search-params";

/**
 * Landing pages for the searches people actually type into a search engine:
 * "studentbostad uppsala", "hyresrätt utan kö solna". Each is a preset over
 * the same search, with its own path under the municipality and its own
 * editorial text. The slugs live in the area segment of the URL, so no area
 * may use one of them.
 */
export const INTENTS = {
  students: { slug: { sv: "student", en: "students" }, filters: { segment: ["student"] } },
  noQueue: { slug: { sv: "utan-ko", en: "no-queue" }, filters: { queue: ["none"] } },
  under8000: { slug: { sv: "under-8000", en: "under-8000" }, filters: { maxRent: 8000 } },
  threeRooms: { slug: { sv: "3-rum-eller-fler", en: "3-rooms-or-more" }, filters: { rooms: [3, 4] } },
} as const satisfies Record<string, { slug: Record<Locale, string>; filters: Partial<SearchFilters> }>;

export type IntentKey = keyof typeof INTENTS;
export const INTENT_KEYS = Object.keys(INTENTS) as IntentKey[];

export function intentBySlug(slug: string, locale: Locale): IntentKey | undefined {
  return INTENT_KEYS.find((k) => INTENTS[k].slug[locale] === slug);
}

export const intentSlug = (key: IntentKey, locale: Locale) => INTENTS[key].slug[locale];

/** The preset over a fresh set of filters; page and sort stay default. */
export function intentFilters(key: IntentKey, base: SearchFilters): SearchFilters {
  return { ...base, ...INTENTS[key].filters, page: 1, sort: "new" };
}

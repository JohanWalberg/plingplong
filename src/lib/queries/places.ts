import { cache } from "react";
import { escapeLike } from "@/lib/like";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Locale } from "@/i18n/routing";
import { slugify } from "@/lib/slug";

const { municipality, area, listing } = schema;

export type PlaceRef = {
  municipality: typeof municipality.$inferSelect;
  area?: typeof area.$inferSelect;
};

export function municipalityName(m: { nameSv: string; nameEn: string }, locale: Locale) {
  return locale === "sv" ? m.nameSv : m.nameEn;
}
export function municipalitySlug(m: { slugSv: string; slugEn: string }, locale: Locale) {
  return locale === "sv" ? m.slugSv : m.slugEn;
}
export function countyName(m: { countySv: string; countyEn: string }, locale: Locale) {
  return locale === "sv" ? m.countySv : m.countyEn;
}

/** Resolve a municipality by slug in either locale, so language switches keep the entity. */
export const findMunicipalityBySlug = cache(async (slug: string) => {
  return db.query.municipality.findFirst({
    where: or(eq(municipality.slugSv, slug), eq(municipality.slugEn, slug)),
  });
});

export async function findArea(municipalityId: string, slug: string) {
  return db.query.area.findFirst({ where: and(eq(area.municipalityId, municipalityId), eq(area.slug, slug)) });
}

export async function listMunicipalities() {
  return db.query.municipality.findMany({ orderBy: (m, { asc }) => [asc(m.county), asc(m.nameSv)] });
}


export type PlaceMatch =
  | { kind: "municipality"; municipality: typeof municipality.$inferSelect }
  | { kind: "area"; municipality: typeof municipality.$inferSelect; area: typeof area.$inferSelect };

/**
 * Resolves free text from the search box to a municipality or area.
 * Accepts names in either language, slugs, and postcodes present on listings.
 * Returns the best match first plus alternatives for a disambiguation list.
 */
export async function resolvePlace(query: string): Promise<PlaceMatch[]> {
  const q = query.trim();
  if (!q) return [];
  const slug = slugify(q);

  // Postcode (e.g. "169 73" or "16973"): find the municipality of listings with that postcode.
  const digits = q.replace(/\s+/g, "");
  if (/^\d{5}$/.test(digits)) {
    const rows = await db
      .select({ m: municipality })
      .from(listing)
      .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
      .where(sql`replace(${listing.postcode}, ' ', '') = ${digits}`)
      .groupBy(municipality.id)
      .limit(3);
    if (rows.length) return rows.map((r) => ({ kind: "municipality" as const, municipality: r.m }));
    // Fall back on the two-digit postcode area for Stockholm County (10–19).
    if (/^1[0-9]/.test(digits)) {
      const sthlm = await findMunicipalityBySlug("stockholm");
      if (sthlm) return [{ kind: "municipality", municipality: sthlm }];
    }
  }

  const exactMuni = await db.query.municipality.findMany({
    where: or(eq(municipality.slugSv, slug), eq(municipality.slugEn, slug), ilike(municipality.nameSv, escapeLike(q)), ilike(municipality.nameEn, escapeLike(q))),
    limit: 3,
  });
  const out: PlaceMatch[] = exactMuni.map((m) => ({ kind: "municipality", municipality: m }));

  const areas = await db
    .select({ a: area, m: municipality })
    .from(area)
    .innerJoin(municipality, eq(area.municipalityId, municipality.id))
    .where(or(eq(area.slug, slug), ilike(area.name, escapeLike(q)), ilike(area.name, `${escapeLike(q)}%`)))
    .limit(5);
  for (const r of areas) out.push({ kind: "area", municipality: r.m, area: r.a });

  if (!out.length) {
    const fuzzy = await db.query.municipality.findMany({
      where: or(ilike(municipality.nameSv, `${escapeLike(q)}%`), ilike(municipality.nameEn, `${escapeLike(q)}%`)),
      limit: 5,
    });
    out.push(...fuzzy.map((m) => ({ kind: "municipality" as const, municipality: m })));
  }
  return out;
}

export type PlaceSuggestion = { kind: "municipality" | "area"; name: string; detail: string | null; count: number; municipality: typeof municipality.$inferSelect; area?: typeof area.$inferSelect };

/**
 * Prefix suggestions for the search box: municipalities (either language) and
 * areas, each with its count of active homes so the list doubles as a hint of
 * where there is something to find. Cheap enough to run per keystroke.
 */
export async function suggestPlaces(query: string, locale: Locale, limit = 8): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const prefix = `${escapeLike(q)}%`;
  // Written with explicit aliases: drizzle drops the table qualifier inside a
  // correlated subquery, so `${municipality.id}` would resolve to listing.id.
  const muniCount = sql<number>`(select count(*) from listing l where l.municipality_id = municipality.id and l.status = 'active')::int`;
  const areaCount = sql<number>`(select count(*) from listing l where l.area_id = area.id and l.status = 'active')::int`;
  const [munis, areas] = await Promise.all([
    db
      .select({ m: municipality, count: muniCount })
      .from(municipality)
      .where(or(ilike(municipality.nameSv, prefix), ilike(municipality.nameEn, prefix)))
      .orderBy(sql`${muniCount} desc`, municipality.nameSv)
      .limit(limit),
    db
      .select({ a: area, m: municipality, count: areaCount })
      .from(area)
      .innerJoin(municipality, eq(area.municipalityId, municipality.id))
      .where(ilike(area.name, prefix))
      .orderBy(sql`${areaCount} desc`, area.name)
      .limit(limit),
  ]);
  const out: PlaceSuggestion[] = [
    ...munis.map((r) => ({ kind: "municipality" as const, name: municipalityName(r.m, locale), detail: countyName(r.m, locale), count: r.count, municipality: r.m })),
    ...areas.map((r) => ({ kind: "area" as const, name: r.a.name, detail: municipalityName(r.m, locale), count: r.count, municipality: r.m, area: r.a })),
  ];
  // Places with homes first, regardless of kind; then alphabetical.
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, locale));
  return out.slice(0, limit);
}

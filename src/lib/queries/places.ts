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
export async function findMunicipalityBySlug(slug: string) {
  return db.query.municipality.findFirst({
    where: or(eq(municipality.slugSv, slug), eq(municipality.slugEn, slug)),
  });
}

export async function findArea(municipalityId: string, slug: string) {
  return db.query.area.findFirst({ where: and(eq(area.municipalityId, municipalityId), eq(area.slug, slug)) });
}

export async function listMunicipalities() {
  return db.query.municipality.findMany({ orderBy: (m, { asc }) => [asc(m.county), asc(m.nameSv)] });
}

export async function listAreas(municipalityId: string) {
  return db.query.area.findMany({ where: eq(area.municipalityId, municipalityId), orderBy: (a, { asc }) => [asc(a.name)] });
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
    where: or(eq(municipality.slugSv, slug), eq(municipality.slugEn, slug), ilike(municipality.nameSv, q), ilike(municipality.nameEn, q)),
    limit: 3,
  });
  const out: PlaceMatch[] = exactMuni.map((m) => ({ kind: "municipality", municipality: m }));

  const areas = await db
    .select({ a: area, m: municipality })
    .from(area)
    .innerJoin(municipality, eq(area.municipalityId, municipality.id))
    .where(or(eq(area.slug, slug), ilike(area.name, q), ilike(area.name, `${q}%`)))
    .limit(5);
  for (const r of areas) out.push({ kind: "area", municipality: r.m, area: r.a });

  if (!out.length) {
    const fuzzy = await db.query.municipality.findMany({
      where: or(ilike(municipality.nameSv, `${q}%`), ilike(municipality.nameEn, `${q}%`)),
      limit: 5,
    });
    out.push(...fuzzy.map((m) => ({ kind: "municipality" as const, municipality: m })));
  }
  return out;
}

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { municipality, listing } = schema;

/**
 * Municipalities with the most active homes, for the discovery block on the
 * home page. Each carries the photo of its newest home that has one, so the
 * tile shows a real place rather than stock imagery; tiles without a photo
 * fall back to a plain brand ground.
 */
export async function topMunicipalities(limit = 8) {
  const l2 = sql.raw("l2");
  return db
    .select({
      id: municipality.id,
      nameSv: municipality.nameSv,
      nameEn: municipality.nameEn,
      slugSv: municipality.slugSv,
      slugEn: municipality.slugEn,
      count: sql<number>`count(${listing.id})::int`,
      imageUrl: sql<string | null>`(select ${l2}.image_url from listing ${l2} where ${l2}.municipality_id = ${municipality.id} and ${l2}.status = 'active' and ${l2}.taken_down_at is null and ${l2}.image_url is not null order by ${l2}.first_seen_at desc limit 1)`,
    })
    .from(municipality)
    .innerJoin(listing, and(eq(listing.municipalityId, municipality.id), eq(listing.status, "active"), isNull(listing.takenDownAt)))
    .groupBy(municipality.id)
    .orderBy(desc(sql`count(${listing.id})`), municipality.nameSv)
    .limit(limit);
}

import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";

const { municipality, listing } = schema;

/** Municipalities with the most active homes, for the discovery block on the home page. */
export async function topMunicipalities(limit = 8) {
  return db
    .select({ id: municipality.id, nameSv: municipality.nameSv, nameEn: municipality.nameEn, slugSv: municipality.slugSv, slugEn: municipality.slugEn, count: sql<number>`count(${listing.id})::int` })
    .from(municipality)
    .innerJoin(listing, and(eq(listing.municipalityId, municipality.id), eq(listing.status, "active")))
    .groupBy(municipality.id)
    .orderBy(desc(sql`count(${listing.id})`), municipality.nameSv)
    .limit(limit);
}

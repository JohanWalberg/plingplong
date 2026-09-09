import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import type { Locale } from "@/i18n/routing";
import { db, schema } from "@/db";
import { publiclyVisible } from "./listings";

/** Landlord with its municipalities and sources; shared by the page, its layout and the share image. */
export const landlordBySlug = cache(async (slug: string) => {
  return db.query.landlord.findFirst({
    where: eq(schema.landlord.slug, slug),
    with: { municipalities: { with: { municipality: { columns: { centroid: false, geom: false } } } }, sources: true },
  });
});

/** Locale of the landlord's owner account, for mail that goes to the organisation rather than a person; Swedish when there is none. */
export async function landlordLocale(landlordId: string): Promise<Locale> {
  const [row] = await db
    .select({ locale: schema.user.locale })
    .from(schema.landlordMember)
    .innerJoin(schema.user, eq(schema.user.id, schema.landlordMember.userId))
    .where(and(eq(schema.landlordMember.landlordId, landlordId), eq(schema.landlordMember.role, "owner")))
    .limit(1);
  return row?.locale === "en" ? "en" : "sv";
}

export type LandlordDirectoryEntry = {
  id: string;
  slug: string;
  name: string;
  type: "municipal" | "private" | "agency" | "foundation";
  isMonitored: boolean;
  /** Homes the public can see right now; 0 for an unmonitored landlord. */
  count: number;
  /** Where the landlord operates, by municipality id, for the directory filter. */
  municipalityIds: string[];
};

/**
 * Every known landlord with its live home count and the municipalities it
 * operates in. The list is small (dozens, low hundreds at most) and the page is
 * prerendered, so the browser filters it; this returns everything once.
 */
export async function landlordDirectory(): Promise<LandlordDirectoryEntry[]> {
  const { landlord, listing, landlordMunicipality } = schema;
  const rows = await db
    .select({
      id: landlord.id,
      slug: landlord.slug,
      name: landlord.name,
      type: landlord.type,
      isMonitored: landlord.isMonitored,
      count: sql<number>`count(distinct ${listing.id}) filter (where ${publiclyVisible()})::int`,
      municipalityIds: sql<string[]>`coalesce(array_agg(distinct ${landlordMunicipality.municipalityId}) filter (where ${landlordMunicipality.municipalityId} is not null), '{}')`,
    })
    .from(landlord)
    .leftJoin(listing, eq(listing.landlordId, landlord.id))
    .leftJoin(landlordMunicipality, eq(landlordMunicipality.landlordId, landlord.id))
    .where(eq(landlord.isKnown, true))
    .groupBy(landlord.id)
    .orderBy(sql`${landlord.isMonitored} desc`, sql`count(distinct ${listing.id}) filter (where ${publiclyVisible()}) desc`, landlord.name);
  return rows;
}

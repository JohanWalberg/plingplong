import { cache } from "react";
import { and, eq } from "drizzle-orm";
import type { Locale } from "@/i18n/routing";
import { db, schema } from "@/db";

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

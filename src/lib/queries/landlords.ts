import { cache } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

/** Landlord with its municipalities and sources; shared by the page, its layout and the share image. */
export const landlordBySlug = cache(async (slug: string) => {
  return db.query.landlord.findFirst({
    where: eq(schema.landlord.slug, slug),
    with: { municipalities: { with: { municipality: { columns: { centroid: false, geom: false } } } }, sources: true },
  });
});

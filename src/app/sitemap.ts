import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { routing, type Locale } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo";
import { municipalitySlug } from "@/lib/queries/places";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const out: MetadataRoute.Sitemap = [];
  const push = (hrefFor: (l: Locale) => Parameters<typeof absoluteUrl>[1], lastModified?: Date, priority = 0.5) => {
    for (const l of routing.locales) {
      const languages: Record<string, string> = {};
      for (const other of routing.locales) languages[other] = absoluteUrl(other, hrefFor(other));
      out.push({ url: absoluteUrl(l, hrefFor(l)), lastModified, priority, alternates: { languages } });
    }
  };

  push(() => "/", undefined, 1);
  for (const p of ["/homes", "/municipalities", "/landlords", "/how-it-works", "/coverage", "/faq", "/contact", "/about-collection", "/privacy", "/cookies", "/terms", "/for-landlords"] as const) push(() => p);

  const munis = await db.query.municipality.findMany({ columns: { slugSv: true, slugEn: true } });
  for (const m of munis) {
    push((l) => ({ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(m, l) } }), undefined, 0.7);
  }
  const landlords = await db.query.landlord.findMany({ columns: { slug: true, updatedAt: true }, where: eq(schema.landlord.isKnown, true) });
  for (const l of landlords) push(() => ({ pathname: "/landlords/[slug]", params: { slug: l.slug } }), l.updatedAt, 0.6);

  const listings = await db.query.listing.findMany({ columns: { slug: true, updatedAt: true }, where: eq(schema.listing.status, "active") });
  for (const l of listings) push(() => ({ pathname: "/home/[slug]", params: { slug: l.slug } }), l.updatedAt, 0.8);

  return out;
}

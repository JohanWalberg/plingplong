import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { municipalitySlug } from "./queries/places";
import { invalidate, LISTINGS_NS } from "./ttl-cache";

/**
 * Clears the memoized search queries and every prerendered public page.
 *
 * Used by portal and admin actions, where one person changed one thing and the
 * cost of over-clearing is a single re-render. A crawl is different: it happens
 * every few minutes, and clearing everything each time leaves the prerendered
 * pages serving a cached copy almost never. Crawls use the scoped version below.
 */
export function invalidateListingCaches() {
  invalidate(LISTINGS_NS);
  revalidatePath("/[locale]/(public)", "layout");
}

/** Pages that show site-wide totals or the newest homes, so any change reaches them. */
const GLOBAL_HREFS = ["/", "/coverage", "/municipalities", "/landlords"] as const;

/**
 * Clears the memo plus only the pages a crawl can have changed: the four
 * site-wide ones, and the municipality and landlord pages it actually touched.
 * Listing and search pages are rendered per request, so they need nothing.
 */
export async function invalidateListingCachesFor(scope: { municipalityIds?: string[]; landlordIds?: string[] }): Promise<number> {
  invalidate(LISTINGS_NS);
  const paths = new Set<string>();
  for (const locale of routing.locales) for (const href of GLOBAL_HREFS) paths.add(getPathname({ locale, href }));

  const municipalityIds = [...new Set(scope.municipalityIds ?? [])];
  if (municipalityIds.length) {
    const rows = await db
      .select({ slugSv: schema.municipality.slugSv, slugEn: schema.municipality.slugEn })
      .from(schema.municipality)
      .where(inArray(schema.municipality.id, municipalityIds));
    for (const m of rows) {
      for (const locale of routing.locales) paths.add(getPathname({ locale, href: { pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(m, locale) } } }));
    }
  }

  const landlordIds = [...new Set(scope.landlordIds ?? [])];
  if (landlordIds.length) {
    const rows = await db.select({ slug: schema.landlord.slug }).from(schema.landlord).where(inArray(schema.landlord.id, landlordIds));
    for (const l of rows) {
      for (const locale of routing.locales) paths.add(getPathname({ locale, href: { pathname: "/landlords/[slug]", params: { slug: l.slug } } }));
    }
  }

  for (const p of paths) revalidatePath(p);
  return paths.size;
}

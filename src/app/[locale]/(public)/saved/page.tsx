import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { inArray, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveLocale } from "@/lib/locale";
import { SiteHeader } from "@/components/site/header";
import { ListingCard } from "@/components/listing/listing-card";
import { SavedSearches } from "@/components/search/saved-searches";
import { parseSavedCookie, SAVED_COOKIE } from "@/lib/saved";
import type { SearchResultItem } from "@/lib/queries/listings";
import { sql } from "drizzle-orm";

type Props = { params: Promise<{ locale: string }> };

export const metadata: Metadata = { robots: { index: false } };

export default async function SavedPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("listing");
  const tn = await getTranslations("navigation");
  const slugs = parseSavedCookie((await cookies()).get(SAVED_COOKIE)?.value);
  const { listing, landlord, municipality } = schema;
  const rows = slugs.length
    ? await db
        .select({
          id: listing.id,
          slug: listing.slug,
          address: listing.address,
          areaName: listing.areaName,
          municipalityName: locale === "sv" ? municipality.nameSv : municipality.nameEn,
          rentMonthly: listing.rentMonthly,
          rooms: listing.rooms,
          sizeSqm: listing.sizeSqm,
          imageUrl: listing.imageUrl,
          landlordName: landlord.name,
          landlordSlug: landlord.slug,
          lastCheckedAt: listing.lastCheckedAt,
          applicationDeadline: listing.applicationDeadline,
          queueRequirement: listing.queueRequirement,
          contractType: listing.contractType,
          segment: listing.segment,
          firstSeenAt: listing.firstSeenAt,
          publishedDirectly: listing.publishedDirectly,
          status: listing.status,
          lat: sql<number | null>`null`,
          lon: sql<number | null>`null`,
        })
        .from(listing)
        .innerJoin(landlord, eq(listing.landlordId, landlord.id))
        .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
        .where(and(inArray(listing.slug, slugs)))
    : [];
  const ordered = slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as Array<SearchResultItem & { status: string }>;

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{tn("saved")}</h1>
        <SavedSearches />
        <h2 className="mt-10 text-h2">{t("savedHomes")}</h2>
        {ordered.length ? (
          <ul className="mt-4 flex flex-col gap-3">
            {ordered.map((l) => (
              <li key={l.id} className="list-none">
                <ListingCard listing={l} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink-2">{t("noSavedHomes")}</p>
        )}
      </main>
    </>
  );
}

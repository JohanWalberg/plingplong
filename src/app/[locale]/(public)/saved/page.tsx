import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { inArray, eq, and, ne } from "drizzle-orm";
import { db, schema } from "@/db";
import { resolveLocale } from "@/lib/locale";
import { SiteHeader } from "@/components/site/header";
import { ListingCard } from "@/components/listing/listing-card";
import { SaveButton } from "@/components/listing/save-button";
import { CopyListButton } from "@/components/listing/copy-list-button";
import { Badge } from "@/components/ui/badge";
import { deadlineState } from "@/lib/listing-display";
import { formatRent } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo";
import { SavedSearches } from "@/components/search/saved-searches";
import { RecentlyViewed } from "@/components/listing/recently-viewed";
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
        .where(and(inArray(listing.slug, slugs), ne(listing.status, "draft")))
    : [];
  const ordered = slugs.map((s) => rows.find((r) => r.slug === s)).filter(Boolean) as Array<SearchResultItem & { status: string }>;
  const td = await getTranslations("deadline");
  // Available homes first, soonest deadline first; homes that are gone go in their own group.
  const available = ordered
    .filter((l) => l.status === "active")
    .sort((a, b) => (a.applicationDeadline ?? "9999").localeCompare(b.applicationDeadline ?? "9999"));
  const gone = ordered.filter((l) => l.status !== "active");
  const lines = available.map((l) => `${l.address}, ${l.areaName ? `${l.areaName}, ` : ""}${l.municipalityName} · ${l.rentMonthly !== null ? formatRent(locale, l.rentMonthly) : t("rentUnknown")} · ${absoluteUrl(locale, { pathname: "/home/[slug]", params: { slug: l.slug } })}`);

  const item = (l: (typeof ordered)[number]) => {
    const d = deadlineState(l.applicationDeadline);
    const days = "days" in d ? d.days : undefined;
    const showDays = l.status === "active" && days !== undefined && days >= 0 && days <= 14;
    return (
      <li key={l.id} className="list-none">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {showDays ? (
            <Badge tone={d.tone} icon={d.tone === "urgent" ? "warn" : "clock"}>
              {td("daysLeft", { count: days! })}
            </Badge>
          ) : (
            <span />
          )}
          <SaveButton slug={l.slug} listingId={l.id} size="md" iconOnly />
        </div>
        <ListingCard listing={l} />
      </li>
    );
  };

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{tn("saved")}</h1>
        <SavedSearches />
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-h2">{t("savedHomes")}{ordered.length ? <span className="ml-2 text-[16px] font-[600] text-muted tabular">({ordered.length})</span> : null}</h2>
          {available.length ? <CopyListButton lines={lines} /> : null}
        </div>
        {available.length ? <ul className="mt-4 flex flex-col gap-4">{available.map(item)}</ul> : null}
        {!ordered.length ? <p className="mt-3 text-ink-2">{t("noSavedHomes")}</p> : null}
        {gone.length ? (
          <section aria-labelledby="saved-gone" className="mt-10">
            <h2 id="saved-gone" className="text-h3 text-muted">{t("savedGone")}</h2>
            <p className="mt-1 text-[14px] text-muted">{t("savedGoneBody")}</p>
            <ul className="mt-4 flex flex-col gap-4 opacity-80">{gone.map(item)}</ul>
          </section>
        ) : null}
        <RecentlyViewed className="mt-12" />
      </main>
    </>
  );
}

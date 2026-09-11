import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { db, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { CoverageCard } from "@/components/site/coverage-card";
import { ListingCard } from "@/components/listing/listing-card";
import { Card } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { formatSek } from "@/lib/format";
import { areaCounts, coverageFor, landlordCountsFor, listingsForMunicipality, municipalityStats } from "@/lib/queries/listings";
import { countyName, findMunicipalityBySlug, municipalityName, municipalitySlug } from "@/lib/queries/places";

export const revalidate = 300;

/** Prerender every municipality per locale; new ones render on demand. */
export async function generateStaticParams({ params }: { params: { locale: string } }) {
  try {
    const rows = await db.select({ sv: schema.municipality.slugSv, en: schema.municipality.slugEn }).from(schema.municipality);
    return rows.map((r) => ({ slug: params.locale === "en" ? r.en : r.sv }));
  } catch (e) {
    // No database at build time (fresh deploy, CI): render on demand instead of failing the build.
    console.warn(`generateStaticParams: rendering on demand (${(e as Error).message.split("\n")[0]})`);
    return [];
  }
}

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const muni = await findMunicipalityBySlug(slug);
  if (!muni) return {};
  const t = await getTranslations({ locale, namespace: "municipality" });
  const [stats, landlords] = await Promise.all([municipalityStats(muni.id), landlordCountsFor(muni.id)]);
  const title = t("title", { place: municipalityName(muni, locale) });
  const description = `${t("statListings")}: ${stats.listings}. ${t("intro", { count: landlords.length, place: municipalityName(muni, locale) })}`;
  return {
    title,
    description,
    openGraph: { title, description },
    alternates: alternatesFor(locale, (l) => ({ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(muni, l) } })),
  };
}

export default async function MunicipalityPage({ params }: Props) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const muni = await findMunicipalityBySlug(slug);
  if (!muni) notFound();
  const name = municipalityName(muni, locale);
  const [t, tl, coverage, stats, areas, landlords, listings] = await Promise.all([
    getTranslations("municipality"),
    getTranslations("landlord"),
    coverageFor(muni.id),
    municipalityStats(muni.id),
    areaCounts(muni.id),
    landlordCountsFor(muni.id),
    listingsForMunicipality(locale, muni.id, 3),
  ]);
  const placeSlug = municipalitySlug(muni, locale);

  return (
    <>
      <SiteHeader active="municipalities" />
      <main id="main">
        <section className="border-b border-line bg-bg">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
            <nav aria-label={(await getTranslations("common"))("navBreadcrumb")} className="text-[13.5px] text-muted">
              <Link href="/municipalities" className="text-muted hover:text-ink">
                {t("crumbRoot")}
              </Link>
              <span aria-hidden="true"> / </span>
              <span>{countyName(muni, locale)}</span>
            </nav>
            <h1 className="mt-3 font-serif text-[36px] leading-tight sm:text-[44px]">{t("title", { place: name })}</h1>
            <p className="mt-2 max-w-[60ch] text-ink-2">{t("intro", { count: coverage.monitored, place: name })}</p>
            <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
              <div>
                <dd className="text-[28px] font-[700] leading-none tabular">{stats?.listings ?? 0}</dd>
                <dt className="mt-1 text-meta text-muted">{t("statListings")}</dt>
              </div>
              <div>
                <dd className="text-[28px] font-[700] leading-none tabular">{coverage.monitored}</dd>
                <dt className="mt-1 text-meta text-muted">{t("statLandlords")}</dt>
              </div>
              {stats?.medianRent2 ? (
                <div>
                  <dd className="text-[28px] font-[700] leading-none tabular">{formatSek(locale, Math.round(stats.medianRent2))}</dd>
                  <dt className="mt-1 text-meta text-muted">{t("statMedianRent")}</dt>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
          <div className="flex min-w-0 flex-col gap-8">
            {areas.some((a) => a.count > 0) ? (
              <section aria-labelledby="areas">
                <h2 id="areas" className="text-h2">
                  {t("areasTitle")}
                </h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {areas
                    .filter((a) => a.count > 0)
                    .map((a) => (
                      <li key={a.id} className="min-w-0 list-none">
                        <Link
                          href={{ pathname: "/homes/[place]/[area]", params: { place: placeSlug, area: a.slug } }}
                          className="inline-flex min-h-touch items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-[600] text-ink hover:bg-bg hover:no-underline"
                        >
                          {a.name}
                          <span className="text-meta text-muted tabular">{a.count}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="listings">
              <h2 id="listings" className="text-h2">
                {t("listingsTitle", { place: name })}
              </h2>
              {listings.items.length ? (
                <ul className="mt-4 flex flex-col gap-3">
                  {listings.items.map((l) => (
                    <li key={l.id} className="min-w-0 list-none">
                      <ListingCard listing={l} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-ink-2">{t("noListings", { place: name })}</p>
              )}
              <p className="mt-5">
                <Link href={{ pathname: "/homes/[place]", params: { place: placeSlug } }} className={buttonClasses("secondary")}>
                  {t("allListings", { count: listings.total })}
                </Link>
              </p>
            </section>
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <CoverageCard place={name} monitored={coverage.monitored} known={coverage.known} />
            <Card as="section" className="p-5" aria-labelledby="landlords">
              <h2 id="landlords" className="text-h3">
                {t("landlordsTitle", { place: name })}
              </h2>
              <ul className="mt-3 flex flex-col divide-y divide-hairline">
                {landlords.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-[14.5px]">
                    <Link href={{ pathname: "/landlords/[slug]", params: { slug: l.slug } }} className="min-w-0 truncate font-[600]">
                      {l.name}
                    </Link>
                    <span className="shrink-0 text-meta text-muted tabular">{l.isMonitored ? l.count : tl("notMonitoredShort")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </aside>
        </div>
      </main>
    </>
  );
}

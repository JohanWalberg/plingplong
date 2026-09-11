import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { SiteHeader } from "@/components/site/header";
import { SearchBox } from "@/components/search/search-box";
import { ListingCard } from "@/components/listing/listing-card";
import { CoverImage } from "@/components/listing/listing-image";
import { RecentlyViewed } from "@/components/listing/recently-viewed";
import { buttonClasses } from "@/components/ui/button";
import { icons } from "@/components/ui/misc";
import { latestListings, siteTotals } from "@/lib/queries/listings";
import { topMunicipalities } from "@/lib/queries/home";
import { municipalityName, municipalitySlug } from "@/lib/queries/places";

// Rendered at build time and refreshed every five minutes; listing changes from
// the portal and admin clear it immediately through invalidateListingCaches().
export const revalidate = 300;

const POPULAR = ["stockholm", "solna", "goteborg", "malmo", "uppsala"] as const;

/** Faint house-and-door outline behind the hero: the logo's world, kept very quiet. */
function HeroDecoration() {
  return (
    <svg aria-hidden="true" viewBox="0 0 320 320" className="pointer-events-none absolute -right-10 top-1/2 hidden h-[360px] w-[360px] -translate-y-1/2 lg:block" fill="none">
      <path d="M40 150 L160 40 L280 150 V280 H40 Z" stroke="#147af3" strokeOpacity="0.12" strokeWidth="3" strokeLinejoin="round" />
      <path d="M118 280 V190 a42 42 0 0 1 84 0 V280" stroke="#147af3" strokeOpacity="0.16" strokeWidth="3" />
      <path d="M232 178 a26 26 0 0 1 0 36" stroke="#ffb31a" strokeOpacity="0.7" strokeWidth="6" strokeLinecap="round" />
      <path d="M252 160 a52 52 0 0 1 0 72" stroke="#ffb31a" strokeOpacity="0.45" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** A municipality as a place, not a row: the newest home's photo behind the name and the count. */
function MunicipalityTile({ name, slug, count, imageUrl }: { name: string; slug: string; count: string; imageUrl: string | null }) {
  return (
    <Link
      href={{ pathname: "/homes/[place]", params: { place: slug } }}
      className={`group relative flex min-h-[150px] overflow-hidden rounded-lg bg-navy text-white hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue sm:min-h-[170px]`}
    >
      <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,179,26,.35),transparent_55%),linear-gradient(160deg,#0f63c9,#052b55)]" />
      {imageUrl ? (
        <span aria-hidden="true" className="absolute inset-0 overflow-hidden">
          <CoverImage src={imageUrl} sizes="(min-width: 768px) 300px, 50vw" className="transition-transform duration-300 group-hover:scale-[1.03]" />
        </span>
      ) : null}
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,43,85,.9)_0%,rgba(5,43,85,.4)_50%,transparent_100%)]" />
      <span className="relative mt-auto flex w-full flex-col gap-0.5 p-4">
        <span className="text-[19px] font-[800] leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,.35)]">{name}</span>
        <span className="text-[13px] font-[600] text-white/90 tabular [text-shadow:0_1px_2px_rgba(0,0,0,.35)]">{count}</span>
      </span>
    </Link>
  );
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("home");
  const tf = await getTranslations("portal.landing");
  const [latest, totals, munis] = await Promise.all([latestListings(locale, 6), siteTotals(), topMunicipalities(8)]);

  return (
    <>
      <SiteHeader />
      <main id="main">
        {/* 1–3: headline, search, primary CTA */}
        <section className="relative overflow-hidden border-b border-line bg-canvas">
          <div className="relative mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24">
            <HeroDecoration />
            <div className="relative max-w-[720px]">
              <h1 className="font-serif text-[40px] leading-[1.05] sm:text-[56px]">{t("title")}</h1>
              {/* What we actually have, never a share of the market: coverage is its own page. */}
              <p className="mt-4 max-w-[52ch] text-[18px] leading-relaxed text-ink-2">
                {totals.homes ? (
                  <>
                    {t("totals", { homes: totals.homes, landlords: totals.landlords, municipalities: totals.municipalities })}{" "}
                    <Link href="/coverage" className="font-[600]">
                      {t("totalsLink")}
                    </Link>
                  </>
                ) : (
                  t("sub")
                )}
              </p>
              <div className="mt-8 rounded-xl border border-line bg-surface p-3 shadow-[0_8px_30px_rgba(6,59,114,.08)] sm:p-4">
                <SearchBox locale={locale} />
              </div>
              <p className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
                <span>{t("popular")}</span>
                {POPULAR.map((p) => (
                  <Link
                    key={p}
                    href={{ pathname: "/homes/[place]", params: { place: p === "goteborg" && locale === "en" ? "gothenburg" : p } }}
                    className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-[600] text-primary hover:border-blue hover:text-blue hover:no-underline"
                  >
                    {p === "goteborg" ? (locale === "sv" ? "Göteborg" : "Gothenburg") : p === "malmo" ? "Malmö" : p[0].toUpperCase() + p.slice(1)}
                  </Link>
                ))}
              </p>
              {/* The contrast with the paid portals, said once, where the search starts. */}
              <p className="mt-5 flex items-center gap-2 text-[14.5px] font-[600] text-primary">
                <span className="text-accent-hover">{icons.check}</span>
                {t("free")}
              </p>
            </div>
          </div>
        </section>

        {/* 4: available homes */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6" aria-labelledby="latest">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="latest" className="font-serif text-[28px] leading-tight">
              {t("latest")}
            </h2>
            <Link href="/homes" className={buttonClasses("secondary", "sm")}>
              {t("seeAll")}
            </Link>
          </div>
          <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((l) => (
              <li key={l.id} className="min-w-0 list-none">
                <ListingCard listing={l} variant="home" />
              </li>
            ))}
          </ul>
        </section>

        <RecentlyViewed className="mx-auto max-w-[1200px] px-4 pb-14 sm:px-6" />

        {/* 5: municipality discovery */}
        {munis.length ? (
          <section className="border-y border-line bg-canvas" aria-labelledby="munis">
            <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="munis" className="font-serif text-[28px] leading-tight">
                    {t("municipalitiesTitle")}
                  </h2>
                  <p className="mt-1 text-ink-2">{t("municipalitiesSub")}</p>
                </div>
                <Link href="/municipalities" className="font-[600]">
                  {t("allMunicipalities")} →
                </Link>
              </div>
              <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
                {munis.map((m) => (
                  <li key={m.id} className="list-none">
                    <MunicipalityTile name={municipalityName(m, locale)} slug={municipalitySlug(m, locale)} count={t("homesCount", { count: m.count })} imageUrl={m.imageUrl} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

        {/* 6: benefits */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6" aria-labelledby="benefits">
          <h2 id="benefits" className="font-serif text-[28px] leading-tight">
            {t("benefitsTitle")}
          </h2>
          <ol className="mt-6 grid gap-5 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="flex gap-4 rounded-lg border border-line bg-surface p-5">
                <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-[14px] font-[800] text-navy tabular">
                  {n}
                </span>
                <div>
                  <h3 className="text-h3">{t(`prop${n}Title`)}</h3>
                  <p className="mt-1 text-[14.5px] text-ink-2">{t(`prop${n}Body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 7: landlords */}
        <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6" aria-labelledby="landlords">
          <div className="grid gap-8 rounded-xl bg-navy px-6 py-10 text-dark-text sm:px-10 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h2 id="landlords" className="font-serif text-[28px] leading-tight text-white">
                {t("landlordTitle")}
              </h2>
              <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-dark-muted">{t("landlordBody")}</p>
              <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-dark-text">
                {([1, 2, 3] as const).map((n) => (
                  <li key={n} className="flex items-center gap-2">
                    <span className="text-accent">{icons.check}</span>
                    {tf(`path1Point${n}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <Link href="/for-landlords/create-account" className={buttonClasses("primary", "lg")}>
                {t("landlordCta")}
              </Link>
              <Link href="/for-landlords" className="text-[14px] font-[600] text-dark-accent hover:text-white">
                {t("landlordMore")} →
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

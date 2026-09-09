import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { SiteHeader } from "@/components/site/header";
import { SearchBox } from "@/components/search/search-box";
import { ListingCard } from "@/components/listing/listing-card";
import { RecentlyViewed } from "@/components/listing/recently-viewed";
import { latestListings, siteTotals } from "@/lib/queries/listings";

// Rendered at build time and refreshed every five minutes; listing changes from
// the portal and admin clear it immediately through invalidateListingCaches().
export const revalidate = 300;

const POPULAR = ["stockholm", "solna", "goteborg", "malmo", "uppsala"] as const;

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("home");
  const [latest, totals] = await Promise.all([latestListings(locale, 3), siteTotals()]);

  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="border-b border-line bg-bg">
          <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
            <h1 className="font-serif text-[40px] leading-[1.08] sm:text-display">{t("title")}</h1>
            <p className="mt-3 max-w-[48ch] text-[17px] text-ink-2">{t("sub")}</p>
            <div className="mt-8 max-w-[720px]">
              <SearchBox locale={locale} />
            </div>
            {/* What we actually have, never a share of the market: coverage is its own page. */}
            {totals.homes ? (
              <p className="mt-3 text-[14px] text-ink-2">
                {t("totals", { homes: totals.homes, landlords: totals.landlords, municipalities: totals.municipalities })}{" "}
                <Link href="/coverage" className="font-[600]">
                  {t("totalsLink")}
                </Link>
              </p>
            ) : null}
            <p className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
              <span>{t("popular")}</span>
              {POPULAR.map((p) => (
                <Link
                  key={p}
                  href={{ pathname: "/homes/[place]", params: { place: p === "goteborg" && locale === "en" ? "gothenburg" : p } }}
                  className="inline-flex min-h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-[13.5px] font-[600] text-ink hover:bg-bg hover:no-underline"
                >
                  {p === "goteborg" ? (locale === "sv" ? "Göteborg" : "Gothenburg") : p === "malmo" ? "Malmö" : p[0].toUpperCase() + p.slice(1)}
                </Link>
              ))}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
          <ol className="grid gap-8 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="flex gap-4">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-[13px] font-[700] tabular">
                  {n}
                </span>
                <div>
                  <h2 className="text-h3">{t(`prop${n}Title`)}</h2>
                  <p className="mt-1 text-[14.5px] text-ink-2">{t(`prop${n}Body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <RecentlyViewed className="mx-auto max-w-[1200px] px-4 pb-12 sm:px-6" />

        <section className="mx-auto max-w-[1200px] px-4 pb-16 sm:px-6" aria-labelledby="latest">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="latest" className="text-h2">
              {t("latest")}
            </h2>
            <Link href="/homes" className="text-[14px] font-[650]">
              {t("seeAll")}
            </Link>
          </div>
          {/* min-w-0 on the items: a grid item defaults to min-width:auto, so the
              widest card sizes the whole column. A landlord with a long name
              pushed the home page sideways on a phone. */}
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((l) => (
              <li key={l.id} className="min-w-0 list-none">
                <ListingCard listing={l} variant="home" />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

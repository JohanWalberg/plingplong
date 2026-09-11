import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site/header";
import { SearchBox } from "@/components/search/search-box";
import { AlertButton } from "@/components/search/alert-button";
import { ListingCard } from "@/components/listing/listing-card";
import { buttonClasses } from "@/components/ui/button";
import { INTENT_KEYS, intentFilters, intentSlug, type IntentKey } from "@/lib/intents";
import { parseSearchParams } from "@/lib/search-params-parse";
import { toQuery } from "@/lib/search-params";
import { searchListings } from "@/lib/queries/listings";
import { municipalityName, municipalitySlug } from "@/lib/queries/places";
import type { Municipality } from "@/db/schema";

const LANDING_SIZE = 12;

/**
 * "Studentbostäder i Uppsala": a landing page over one preset search. The
 * full search with its filters is one click away; this page exists to be
 * found, to explain, and to hand over a watchable search.
 */
export async function IntentPage({ locale, muni, intent }: { locale: Locale; muni: Municipality; intent: IntentKey }) {
  const t = await getTranslations("intents");
  const tr = await getTranslations("results");
  const tc = await getTranslations("common");
  const place = municipalityName(muni, locale);
  const placeSlug = municipalitySlug(muni, locale);
  const filters = intentFilters(intent, parseSearchParams({}));
  const query = toQuery(filters);
  const result = await searchListings(locale, { municipalityId: muni.id }, filters, LANDING_SIZE);
  const label = t(`${intent}Title`, { place });

  return (
    <>
      <SiteHeader active="search">
        <SearchBox locale={locale} defaultValue={place} size="md" showButton={false} />
      </SiteHeader>
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <nav aria-label={tc("navBreadcrumb")} className="text-[13.5px] text-muted">
          <Link href={{ pathname: "/municipalities/[slug]", params: { slug: placeSlug } }} className="text-ink-2">
            {place}
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{t(`${intent}Label`)}</span>
        </nav>
        <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="min-w-0">
            <h1 className="font-serif text-[34px] leading-tight sm:text-[42px]">{label}</h1>
            <p className="mt-3 max-w-[64ch] text-[16.5px] leading-relaxed text-ink-2">{t(`${intent}Intro`, { place })}</p>
            <p className="mt-2 text-[14px] text-muted">{tr("headingAll", { count: result.total })}</p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Link href={{ pathname: "/homes/[place]", params: { place: placeSlug }, query }} className={buttonClasses("primary", "md")}>
                {t("seeAllFiltered", { count: result.total })}
              </Link>
              <AlertButton locale={locale} label={label} place={placeSlug} query={query} />
            </div>
            {result.items.length ? (
              <ul className="mt-8 flex flex-col gap-3">
                {result.items.map((l) => (
                  <li key={l.id} className="min-w-0 list-none">
                    <ListingCard listing={l} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-8 rounded-md border border-line bg-surface p-5 text-ink-2">{t("empty", { place })}</p>
            )}
          </div>
          <aside className="rounded-lg border border-line bg-surface p-5">
            <h2 className="text-label font-[650] uppercase tracking-wide text-muted">{t("popularSearches", { place })}</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {INTENT_KEYS.filter((k) => k !== intent).map((k) => (
                <li key={k} className="list-none">
                  <Link href={{ pathname: "/homes/[place]/[area]", params: { place: placeSlug, area: intentSlug(k, locale) } }} className="flex min-h-touch items-center font-[600]">
                    {t(`${k}Title`, { place })}
                  </Link>
                </li>
              ))}
              <li className="list-none">
                <Link href={{ pathname: "/homes/[place]", params: { place: placeSlug } }} className="flex min-h-touch items-center font-[600]">
                  {t("allHomes", { place })}
                </Link>
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </>
  );
}

/** Chip row linking to the intent pages, for the municipality page and the plain municipality search. */
export async function IntentChips({ locale, muni }: { locale: Locale; muni: Municipality }) {
  const t = await getTranslations("intents");
  const place = municipalityName(muni, locale);
  const placeSlug = municipalitySlug(muni, locale);
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
      <span>{t("popularSearches", { place })}</span>
      {INTENT_KEYS.map((k) => (
        <Link
          key={k}
          href={{ pathname: "/homes/[place]/[area]", params: { place: placeSlug, area: intentSlug(k, locale) } }}
          className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-3.5 text-[13.5px] font-[600] text-primary hover:border-blue hover:text-blue hover:no-underline"
        >
          {t(`${k}Label`)}
        </Link>
      ))}
    </div>
  );
}

import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/site/header";
import { SearchBox } from "@/components/search/search-box";
import { ActiveChips, FilterPanel, FilterSheet, SortSelect } from "@/components/search/filter-panel";
import { SaveSearchButton } from "@/components/search/save-search-button";
import { AlertButton } from "@/components/search/alert-button";
import { IntentChips, IntentPage } from "@/components/search/intent-page";
import { intentBySlug } from "@/lib/intents";
import { ResultsRegion, SearchTransitionProvider } from "@/components/search/search-transition";
import { ListingCard } from "@/components/listing/listing-card";
import { Callout, icons } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { formatSek } from "@/lib/format";
import { pageWindow } from "@/lib/pagination";
import { parseSearchParams } from "@/lib/search-params-parse";
import { RENT_MAX, toQuery, type RawSearchParams, type SearchFilters } from "@/lib/search-params";
import { coverageFor, failingSourcesFor, landlordFacet, searchListings, type SearchScope } from "@/lib/queries/listings";
import { countyName, findArea, findMunicipalityBySlug, municipalityName, municipalitySlug, resolvePlace } from "@/lib/queries/places";
import type { Municipality, Area } from "@/db/schema";

type Props = {
  locale: Locale;
  placeSlug?: string;
  areaSlug?: string;
  searchParams: RawSearchParams;
};

/** Shared search results page for /homes, /homes/[place] and /homes/[place]/[area]. */
export async function SearchPage({ locale, placeSlug, areaSlug, searchParams }: Props) {
  // Free-text search from the search box: resolve and redirect to the canonical place URL.
  const q = typeof searchParams.q === "string" ? searchParams.q : undefined;
  if (q && !placeSlug) {
    const matches = await resolvePlace(q);
    const best = matches[0];
    if (best) {
      const rest = { ...searchParams };
      delete rest.q;
      const query = toQuery(parseSearchParams(rest));
      if (best.kind === "area") {
        redirect({ href: { pathname: "/homes/[place]/[area]", params: { place: municipalitySlug(best.municipality, locale), area: best.area.slug }, query }, locale });
      } else {
        redirect({ href: { pathname: "/homes/[place]", params: { place: municipalitySlug(best.municipality, locale) }, query }, locale });
      }
    }
  }

  let muni: Municipality | undefined;
  let area: Area | undefined;
  if (placeSlug) {
    muni = await findMunicipalityBySlug(placeSlug);
    if (!muni) return <NoPlace locale={locale} query={placeSlug} />;
    // The area segment doubles as the slot for the intent landing pages.
    const intent = areaSlug ? intentBySlug(areaSlug, locale) : undefined;
    if (intent) return <IntentPage locale={locale} muni={muni} intent={intent} />;
    if (areaSlug) {
      area = await findArea(muni.id, areaSlug);
      if (!area) return <NoPlace locale={locale} query={areaSlug} />;
    }
  }

  const filters = parseSearchParams(searchParams);
  const scope: SearchScope = { municipalityId: muni?.id, areaId: area?.id };
  const [result, landlords, coverage, failing] = await Promise.all([
    searchListings(locale, scope, filters),
    landlordFacet(scope, filters),
    muni ? coverageFor(muni.id) : null,
    muni ? failingSourcesFor(muni.id) : [],
  ]);

  const t = await getTranslations("results");
  const ts = await getTranslations("sorts");
  const tc = await getTranslations("common");
  const placeName = area ? `${area.name}, ${municipalityName(muni!, locale)}` : muni ? municipalityName(muni, locale) : null;
  const heading = placeName ? t("heading", { count: result.total, place: placeName }) : t("headingAll", { count: result.total });
  const sortLabel = ts(filters.sort).toLowerCase();

  return (
    <>
      <SiteHeader active="search">
        <SearchBox locale={locale} defaultValue={q ?? placeName ?? ""} size="md" showButton={false} />
      </SiteHeader>
      <SearchTransitionProvider>
      <main id="main" className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[272px_1fr]">
        <aside className="hidden lg:block" aria-label={(await getTranslations("filters"))("title")}>
          <div className="sticky top-4">
            <FilterPanel filters={filters} landlords={landlords} total={result.total} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-h2" aria-live="polite" aria-atomic="true">
                  {heading}
                </h1>
                <p className="mt-1 text-[13.5px] text-muted">
                  {muni && coverage ? t("coverageLine", { monitored: coverage.monitored, known: coverage.known, place: municipalityName(muni, locale), sort: sortLabel }) : t("sortedBy", { sort: sortLabel })}
                  {/* Which landlords those are, and which we do not read, is on the municipality page. */}
                  {muni && coverage && coverage.known > coverage.monitored ? (
                    <>
                      {" "}
                      <Link href={{ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(muni, locale) } }} className="font-[600] text-ink-2">
                        {t("coverageWhich")}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="lg:hidden">
                  <FilterSheet filters={filters} landlords={landlords} total={result.total} />
                </div>
                <SaveSearchButton label={heading} />
                <AlertButton locale={locale} label={placeName ?? t("allOfSweden")} place={muni ? municipalitySlug(muni, locale) : undefined} area={area?.slug} query={toQuery({ ...filters, page: 1, sort: "new" })} />
                <div className="hidden sm:block">
                  <SortSelect filters={filters} />
                </div>
                <div role="group" className="flex overflow-hidden rounded-md border border-line-strong">
                  <span aria-current="page" className="flex min-h-10 items-center bg-surface-muted px-3 text-[13.5px] font-[650] text-ink">
                    {t("list")}
                  </span>
                  <Link
                    href={{ pathname: "/map", query: { ...toQuery(filters), ...(muni ? { place: municipalitySlug(muni, locale) } : {}), ...(area ? { area: area.slug } : {}) } }}
                    className="flex min-h-10 items-center gap-1.5 px-3 text-[13.5px] font-[650] text-ink-2 hover:bg-bg hover:no-underline"
                  >
                    {icons.pin}
                    {t("map")}
                  </Link>
                </div>
              </div>
            </div>
            <div className="sm:hidden">
              <SortSelect filters={filters} />
            </div>
            <ActiveChips filters={filters} landlords={landlords} />
            {muni && !area ? <IntentChips locale={locale} muni={muni} /> : null}
          </div>

          {failing.length ? (
            <Callout tone="warning" title={t("partialTitle", { failed: failing.length })} icon={icons.warn}>
              {/* A failed run removes nothing, so those homes are still listed; what they are is stale. */}
              {failing.length === 1 && coverage
                ? t("partialBody", { source: failing[0].landlordName, count: Math.max(0, coverage.monitored - 1), place: municipalityName(muni!, locale) })
                : t("partialBodyMany", { failed: failing.length })}
            </Callout>
          ) : null}

          <ResultsRegion>
            {result.items.length ? (
              <ul className="flex flex-col gap-3">
                {result.items.map((l) => (
                  <li key={l.id} className="min-w-0 list-none">
                    <ListingCard listing={l} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState locale={locale} filters={filters} muni={muni} area={area} />
            )}

            {result.pages > 1 ? <Pagination locale={locale} filters={filters} page={result.page} pages={result.pages} muni={muni} area={area} /> : null}
          </ResultsRegion>
          <p className="sr-only" aria-live="polite">
            {tc("resultsCount", { count: result.total })}
          </p>
        </div>
      </main>
      </SearchTransitionProvider>
    </>
  );
}

async function NoPlace({ locale, query }: { locale: Locale; query: string }) {
  const t = await getTranslations("home");
  const matches = await resolvePlace(query);
  return (
    <>
      <SiteHeader active="search">
        <SearchBox locale={locale} defaultValue={query} size="md" showButton={false} />
      </SiteHeader>
      <main id="main" className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
        <h1 className="text-h2">{t("noMatch", { query })}</h1>
        {matches.length ? (
          <>
            <h2 className="mt-6 text-label font-[650] uppercase tracking-wide text-muted">{t("suggestions")}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {matches.map((m) => (
                <li key={m.kind === "area" ? m.area.id : m.municipality.id} className="min-w-0 list-none">
                  <Link
                    href={
                      m.kind === "area"
                        ? { pathname: "/homes/[place]/[area]", params: { place: municipalitySlug(m.municipality, locale), area: m.area.slug } }
                        : { pathname: "/homes/[place]", params: { place: municipalitySlug(m.municipality, locale) } }
                    }
                    className={buttonClasses("secondary", "md")}
                  >
                    {m.kind === "area" ? `${m.area.name}, ${municipalityName(m.municipality, locale)}` : municipalityName(m.municipality, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-8">
          <Link href="/homes" className={buttonClasses("primary")}>
            {t("seeAll")}
          </Link>
        </p>
      </main>
    </>
  );
}

async function EmptyState({ locale, filters, muni, area }: { locale: Locale; filters: SearchFilters; muni?: Municipality; area?: Area }) {
  const t = await getTranslations("states");
  const tf = await getTranslations("filters");
  const actions: Array<{ label: string; href: Parameters<typeof Link>[0]["href"] }> = [];
  const base = area
    ? { pathname: "/homes/[place]/[area]" as const, params: { place: municipalitySlug(muni!, locale), area: area.slug } }
    : muni
      ? { pathname: "/homes/[place]" as const, params: { place: municipalitySlug(muni, locale) } }
      : { pathname: "/homes" as const };

  if (filters.maxRent && filters.maxRent < RENT_MAX) {
    const raised = Math.min(RENT_MAX, filters.maxRent + 2000);
    actions.push({ label: t("raiseRent", { rent: formatSek(locale, raised) }), href: { ...base, query: toQuery({ ...filters, maxRent: raised >= RENT_MAX ? undefined : raised, page: 1 }) } });
  }
  if (filters.rooms.length) {
    const drop = filters.rooms[filters.rooms.length - 1];
    actions.push({ label: t("removeRooms", { rooms: tf("roomsOption", { rooms: drop }) }), href: { ...base, query: toQuery({ ...filters, rooms: filters.rooms.filter((r) => r !== drop), page: 1 }) } });
  }
  if (area) {
    actions.push({ label: t("expandArea", { area: municipalityName(muni!, locale) }), href: { pathname: "/homes/[place]", params: { place: municipalitySlug(muni!, locale) }, query: toQuery({ ...filters, page: 1 }) } });
  } else if (muni) {
    actions.push({ label: t("expandArea", { area: countyName(muni, locale) }), href: { pathname: "/homes", query: toQuery({ ...filters, page: 1 }) } });
  }
  if (actions.length < 3 || (!filters.maxRent && !filters.rooms.length)) {
    actions.push({ label: t("clearAll"), href: base });
  }

  return (
    <section className="rounded-md border border-line bg-surface px-6 py-12 text-center" aria-labelledby="empty-title">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-muted">{icons.search}</span>
      <h2 id="empty-title" className="mt-4 text-h2">
        {t("noResultsTitle")}
      </h2>
      <p className="mx-auto mt-2 max-w-[44ch] text-ink-2">{t("noResultsBody")}</p>
      <ul className="mx-auto mt-6 flex max-w-[360px] flex-col gap-2">
        {actions.slice(0, 3).map((a) => (
          <li key={a.label} className="min-w-0 list-none">
            <Link href={a.href} className={buttonClasses("secondary", "md", "w-full justify-between")}>
              {a.label}
              {icons.arrowRight}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Pagination({ locale, filters, page, pages, muni, area }: { locale: Locale; filters: SearchFilters; page: number; pages: number; muni?: Municipality; area?: Area }) {
  const t = await getTranslations("common");
  const base = area
    ? { pathname: "/homes/[place]/[area]" as const, params: { place: municipalitySlug(muni!, locale), area: area.slug } }
    : muni
      ? { pathname: "/homes/[place]" as const, params: { place: municipalitySlug(muni, locale) } }
      : { pathname: "/homes" as const };
  const href = (p: number) => ({ ...base, query: toQuery({ ...filters, page: p }) });
  return (
    <nav aria-label={t("page", { page, total: pages })} className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={buttonClasses("secondary", "md")}>
          {t("previousPage")}
        </Link>
      ) : (
        <span />
      )}
      <ol className="order-last flex w-full flex-wrap items-center justify-center gap-1 sm:order-none sm:w-auto">
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted">
              …
            </li>
          ) : (
            <li key={p} className="min-w-0 list-none">
              {p === page ? (
                <span aria-current="page" className="flex h-10 min-w-10 items-center justify-center rounded-md bg-ink px-2 text-[14px] font-[700] tabular text-white">
                  {p}
                </span>
              ) : (
                <Link href={href(p)} aria-label={t("page", { page: p, total: pages })} className="flex h-10 min-w-10 items-center justify-center rounded-md px-2 text-[14px] font-[650] tabular text-ink-2 hover:bg-bg hover:no-underline">
                  {p}
                </Link>
              )}
            </li>
          ),
        )}
      </ol>
      {page < pages ? (
        <Link href={href(page + 1)} rel="next" className={buttonClasses("secondary", "md")}>
          {t("nextPage")}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

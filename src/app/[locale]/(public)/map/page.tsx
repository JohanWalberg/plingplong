import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { SearchBox } from "@/components/search/search-box";
import { MapView } from "@/components/map/map-view";
import { icons } from "@/components/ui/misc";
import { parseSearchParams } from "@/lib/search-params-parse";
import { toQuery, type RawSearchParams } from "@/lib/search-params";
import { countMatching, nearestListings, searchListingsForMap, type SearchScope } from "@/lib/queries/listings";
import { findMunicipalityBySlug, municipalityName, municipalitySlug } from "@/lib/queries/places";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "navigation" });
  return { title: t("map"), alternates: alternatesFor(locale, () => "/map"), robots: { index: false } };
}

function parseBbox(v: string | string[] | undefined): [number, number, number, number] | undefined {
  if (typeof v !== "string") return undefined;
  const n = v.split(",").map(Number);
  if (n.length !== 4 || n.some((x) => Number.isNaN(x))) return undefined;
  return n as [number, number, number, number];
}

export default async function MapPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  const placeSlug = typeof sp.place === "string" ? sp.place : undefined;
  const muni = placeSlug ? await findMunicipalityBySlug(placeSlug) : undefined;
  const bbox = parseBbox(sp.bbox);
  const scope: SearchScope = bbox ? { bounds: bbox } : { municipalityId: muni?.id };
  const items = await searchListingsForMap(locale, scope, filters);
  const t = await getTranslations("results");
  const tm = await getTranslations("map");

  // Initial bounds: the bbox from the URL, else the extent of the results.
  let initialBounds = bbox;
  if (!initialBounds && items.length) {
    const lats = items.map((i) => i.lat!).filter((x) => x !== null);
    const lons = items.map((i) => i.lon!).filter((x) => x !== null);
    initialBounds = [Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01];
  }
  const query = { ...toQuery(filters), ...(placeSlug ? { place: placeSlug } : {}) };

  // An empty view is a dead end unless it can say what it is missing and where.
  // Only when the visitor has panned somewhere: an empty whole-country result is
  // the search page's problem, and it already offers its own recovery actions.
  const emptyView = items.length === 0 && bbox !== undefined;
  const centre = bbox ? { lon: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 } : null;
  const [nearby, totalElsewhere] = emptyView && centre ? await Promise.all([nearestListings(locale, centre, filters, 5), countMatching(filters)]) : [[], 0];

  const heading = emptyView ? tm("emptyHeading") : muni ? t("heading", { count: items.length, place: municipalityName(muni, locale) }) : t("headingAll", { count: items.length });

  return (
    <>
      <SiteHeader active="map">
        <SearchBox locale={locale} defaultValue={muni ? municipalityName(muni, locale) : ""} size="md" showButton={false} />
      </SiteHeader>
      <main id="main">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <h1 className="text-h3" aria-live="polite">
            {heading}
          </h1>
          <div role="group" className="flex overflow-hidden rounded-md border border-line-strong">
            <Link
              href={muni ? { pathname: "/homes/[place]", params: { place: municipalitySlug(muni, locale) }, query: toQuery(filters) } : { pathname: "/homes", query: toQuery(filters) }}
              className="flex min-h-10 items-center px-3 text-[13.5px] font-[650] text-ink-2 hover:bg-bg hover:no-underline"
            >
              {t("list")}
            </Link>
            <span aria-current="page" className="flex min-h-10 items-center gap-1.5 bg-surface-muted px-3 text-[13.5px] font-[650] text-ink">
              {icons.pin}
              {t("map")}
            </span>
          </div>
        </div>
        <MapView items={items} query={query} initialBounds={initialBounds} attribution={tm("attribution")} nearby={nearby} totalElsewhere={totalElsewhere} />
      </main>
    </>
  );
}

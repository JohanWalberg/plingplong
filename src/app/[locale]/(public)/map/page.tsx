import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { SearchBox } from "@/components/search/search-box";
import { ActiveChips, FilterQueryExtrasProvider, FilterSheet, SortSelect } from "@/components/search/filter-panel";
import { SearchTransitionProvider } from "@/components/search/search-transition";
import { MapView } from "@/components/map/map-view";
import { icons } from "@/components/ui/misc";
import { parseSearchParams } from "@/lib/search-params-parse";
import { toQuery, type RawSearchParams } from "@/lib/search-params";
import { countMatching, landlordFacet, nearestListings, searchListingsForMap, type SearchScope } from "@/lib/queries/listings";
import { findArea, findMunicipalityBySlug, municipalityName, municipalitySlug, resolvePlace } from "@/lib/queries/places";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

type Bbox = [number, number, number, number];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "navigation" });
  return { title: t("map"), alternates: alternatesFor(locale, () => "/map"), robots: { index: false } };
}

function parseBbox(v: string | string[] | undefined): Bbox | undefined {
  if (typeof v !== "string") return undefined;
  const n = v.split(",").map(Number);
  if (n.length !== 4 || n.some((x) => Number.isNaN(x))) return undefined;
  return n as Bbox;
}

/**
 * A box around a place's centroid, for places we have nothing else to fit to.
 * Longitude is padded twice as wide as latitude because a degree of longitude
 * is about half as long at Swedish latitudes, which keeps the box square.
 */
function boxAround(c: { x: number; y: number }, latPad: number): Bbox {
  return [c.x - latPad * 2, c.y - latPad, c.x + latPad * 2, c.y + latPad];
}

function extentOf(points: Array<{ lat: number | null; lon: number | null }>): Bbox | undefined {
  const lats = points.map((p) => p.lat).filter((x): x is number => x !== null);
  const lons = points.map((p) => p.lon).filter((x): x is number => x !== null);
  if (!lats.length || !lons.length) return undefined;
  return [Math.min(...lons) - 0.01, Math.min(...lats) - 0.01, Math.max(...lons) + 0.01, Math.max(...lats) + 0.01];
}

export default async function MapPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const sp = await searchParams;
  const filters = parseSearchParams(sp);
  const placeSlug = typeof sp.place === "string" ? sp.place : undefined;
  const areaSlug = typeof sp.area === "string" ? sp.area : undefined;

  // Without JS the search box is a plain GET of `q`: resolve it here so the map
  // answers the search itself instead of handing the visitor to the list.
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  if (q && !placeSlug) {
    const best = (await resolvePlace(q))[0];
    if (best) {
      const query = { ...toQuery(filters), place: municipalitySlug(best.municipality, locale), ...(best.kind === "area" ? { area: best.area.slug } : {}) };
      redirect({ href: { pathname: "/map", query }, locale });
    }
  }

  const muni = placeSlug ? await findMunicipalityBySlug(placeSlug) : undefined;
  const area = muni && areaSlug ? await findArea(muni.id, areaSlug) : undefined;
  const bbox = parseBbox(sp.bbox);
  const scope: SearchScope = bbox ? { bounds: bbox } : { municipalityId: muni?.id, areaId: area?.id };
  const [{ items, capped }, landlords] = await Promise.all([searchListingsForMap(locale, scope, filters), landlordFacet(scope, filters)]);
  const t = await getTranslations("results");
  const tm = await getTranslations("map");

  // Where the map opens: the bbox from the URL, else the spread of the results,
  // else a box around the searched place so an empty place still moves the map.
  const placeCentroid = area?.centroid ?? muni?.centroid ?? null;
  const placeBounds = bbox ? undefined : (extentOf(items) ?? (placeCentroid ? boxAround(placeCentroid, area ? 0.02 : 0.09) : undefined));
  const initialBounds = bbox ?? placeBounds;
  // Keyed by the place, so the map glides only when the visitor searches a new one.
  const fitTo = !bbox && muni && placeBounds ? { bounds: placeBounds, key: `${municipalitySlug(muni, locale)}/${area?.slug ?? ""}` } : null;

  const filterQuery = toQuery(filters);
  const scopeQuery: Record<string, string> = bbox ? { bbox: sp.bbox as string } : { ...(placeSlug ? { place: placeSlug } : {}), ...(area ? { area: area.slug } : {}) };

  // An empty view is a dead end unless it can say what it is missing and where.
  // Only when the visitor has narrowed to somewhere: an empty whole-country
  // result is the search page's problem, and it offers its own recovery actions.
  const emptyView = items.length === 0 && (bbox !== undefined || muni !== undefined);
  const centre = bbox ? { lon: (bbox[0] + bbox[2]) / 2, lat: (bbox[1] + bbox[3]) / 2 } : placeCentroid ? { lon: placeCentroid.x, lat: placeCentroid.y } : null;
  const [nearby, totalElsewhere] = emptyView && centre ? await Promise.all([nearestListings(locale, centre, filters, 5), countMatching(filters)]) : [[], 0];

  const placeName = area && muni ? `${area.name}, ${municipalityName(muni, locale)}` : muni ? municipalityName(muni, locale) : null;
  // An empty rectangle and an empty place are missing different things, and
  // "nothing in this map view" reads as nonsense when the visitor asked for a town.
  const emptyByPlace = emptyView && !bbox && placeName;
  const heading = emptyByPlace ? tm("emptyPlaceHeading", { place: placeName }) : emptyView ? tm("emptyHeading") : placeName ? t("heading", { count: items.length, place: placeName }) : t("headingAll", { count: items.length });
  const emptyTitle = emptyByPlace ? tm("emptyPlace", { place: placeName }) : undefined;

  return (
    <>
      <SiteHeader active="map">
        {/* Searching from the map moves the map. Sending the visitor to the list was the bug. */}
        <SearchBox locale={locale} defaultValue={placeName ?? q} size="md" showButton={false} target="map" keepQuery={filterQuery} />
      </SiteHeader>
      <main id="main">
        <SearchTransitionProvider>
          <FilterQueryExtrasProvider value={scopeQuery}>
            <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-h3" aria-live="polite">
                    {heading}
                  </h1>
                  {capped ? <p className="mt-0.5 text-meta text-muted">{tm("capped", { count: items.length })}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <FilterSheet filters={filters} landlords={landlords} total={items.length} />
                  <div className="hidden sm:block">
                    <SortSelect filters={filters} />
                  </div>
                  <div role="group" className="flex overflow-hidden rounded-md border border-line-strong">
                    <Link
                      href={
                        area && muni
                          ? { pathname: "/homes/[place]/[area]", params: { place: municipalitySlug(muni, locale), area: area.slug }, query: filterQuery }
                          : muni
                            ? { pathname: "/homes/[place]", params: { place: municipalitySlug(muni, locale) }, query: filterQuery }
                            : { pathname: "/homes", query: filterQuery }
                      }
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
              </div>
              <ActiveChips filters={filters} landlords={landlords} />
            </div>
            <MapView items={items} query={filterQuery} initialBounds={initialBounds} fitTo={fitTo} emptyTitle={emptyTitle} attribution={tm("attribution")} nearby={nearby} totalElsewhere={totalElsewhere} />
          </FilterQueryExtrasProvider>
        </SearchTransitionProvider>
      </main>
    </>
  );
}

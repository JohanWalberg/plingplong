import { getPathname } from "@/i18n/navigation";
import { toLocale } from "@/lib/locale";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { municipalitySlug, suggestPlaces } from "@/lib/queries/places";

export type SuggestItem = {
  kind: "municipality" | "area";
  name: string;
  detail: string | null;
  count: number;
  /** The canonical results page for the place. */
  href: string;
  /** The same place on the map, so picking one there keeps you on the map. */
  mapHref: string;
};

/** Search-box suggestions: `?q=sol&locale=sv` → municipalities and areas with localized hrefs. */
export async function GET(req: Request) {
  const limit = rateLimit(`suggest:${clientIp(req.headers)}`, 300, 60);
  if (!limit.ok) return new Response(null, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 60);
  const locale = toLocale(url.searchParams.get("locale"));
  const items = await suggestPlaces(q, locale);
  const mapPath = getPathname({ locale, href: "/map" });
  const body: SuggestItem[] = items.map((s) => {
    const place = municipalitySlug(s.municipality, locale);
    const isArea = s.kind === "area" && s.area;
    return {
      kind: s.kind,
      name: s.name,
      detail: s.detail,
      count: s.count,
      href: isArea
        ? getPathname({ locale, href: { pathname: "/homes/[place]/[area]", params: { place, area: s.area!.slug } } })
        : getPathname({ locale, href: { pathname: "/homes/[place]", params: { place } } }),
      // The map takes the place as a query param: no bbox, so the scope is the
      // whole place rather than whatever rectangle the map happened to show.
      mapHref: `${mapPath}?${new URLSearchParams(isArea ? { place, area: s.area!.slug } : { place }).toString()}`,
    };
  });
  return Response.json(body, { headers: { "cache-control": "public, max-age=60" } });
}

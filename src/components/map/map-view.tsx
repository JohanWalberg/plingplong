"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
// The localised Link takes typed routes; the reset href is the current path with
// the bounds dropped, already carrying its locale prefix, so it uses the plain one.
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { ListingMap, type MapMarker } from "./listing-map";
import { buttonClasses } from "@/components/ui/button";
import { icons } from "@/components/ui/misc";
import { formatDistance, formatSek } from "@/lib/format";
import { rentLabel, roomsSizeLabel } from "@/lib/listing-display";
import type { SearchResultItem } from "@/lib/queries/listings";

type Nearby = SearchResultItem & { distanceM: number };

type Props = {
  items: SearchResultItem[];
  /** The active filters only. The scope — place, area or bbox — is added here. */
  query: Record<string, string>;
  initialBounds?: [number, number, number, number];
  attribution?: string;
  /** The closest homes to the current view, when the view itself has none. */
  nearby?: Nearby[];
  /** How many homes match the filters anywhere, so an empty view can say so. */
  totalElsewhere?: number;
  /** Bounds to glide to when the visitor searches a place; keyed by that place. */
  fitTo?: { bounds: [number, number, number, number]; key: string } | null;
  /** What to call an empty result — a rectangle and a place are missing different things. */
  emptyTitle?: string;
};

/**
 * Map view: list beside the map, markers carry the rent, and searching the
 * current view writes its bounds into the URL (so the state is shareable).
 *
 * Panning does not re-query on its own. It used to, and the map fought anyone
 * who just wanted to look around; now a pan offers a "search this area" button
 * and the visitor decides when the results should change.
 */
export function MapView({ items, query, initialBounds, attribution, nearby = [], totalElsewhere = 0, fitTo = null, emptyTitle }: Props) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const ta = useTranslations("actions");
  const tm = useTranslations("map");
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; key: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  /** Bounds the visitor has panned to but not yet searched. */
  const [pendingBounds, setPendingBounds] = useState<[number, number, number, number] | null>(null);

  /**
   * What the next map movement means, when the code caused it. A jump to a home
   * the visitor picked out of the nearby list is them asking for that place, so
   * it searches straight away; centring on a home already in the list is just a
   * camera move and must not offer to re-search. Cleared on the movement it
   * describes, and on a timer in case that movement never lands.
   */
  const moveIntent = useRef<"search" | "ignore" | null>(null);
  function intend(kind: "search" | "ignore") {
    moveIntent.current = kind;
    setTimeout(() => (moveIntent.current = null), 1500);
  }

  function choose(i: SearchResultItem) {
    setSelected(i.id);
    if (i.lat === null || i.lon === null) return;
    intend("ignore");
    setFocus({ lon: i.lon, lat: i.lat, key: Date.now() });
  }

  /** Flying to a home outside the view moves the map, which re-queries and brings it into the list. */
  function flyTo(i: Nearby) {
    if (i.lat === null || i.lon === null) return;
    intend("search");
    setFocus({ lon: i.lon, lat: i.lat, key: Date.now() });
  }

  // Clearing the bounds from the URL goes back to everything that matches the filters.
  const showAllHref = `${pathname}?${new URLSearchParams(query).toString()}`;
  const [, startTransition] = useTransition();

  const markers: MapMarker[] = useMemo(
    () =>
      items
        .filter((i) => i.lat !== null && i.lon !== null)
        .map((i) => ({ id: i.id, lat: i.lat!, lon: i.lon!, label: i.rentMonthly === null ? t("rentUnknown") : formatSek(locale, i.rentMonthly), slug: i.slug, address: i.address })),
    [items, locale, t],
  );

  /** Searching a rectangle replaces the place: the bounds are the scope now. */
  const searchBounds = useCallback(
    (b: [number, number, number, number]) => {
      const bbox = b.map((n) => n.toFixed(4)).join(",");
      setPendingBounds(null);
      startTransition(() => {
        router.replace(`${pathname}?${new URLSearchParams({ ...query, bbox }).toString()}`, { scroll: false });
      });
    },
    [pathname, query, router],
  );

  const onMoveEnd = useCallback(
    (b: [number, number, number, number], userMoved: boolean) => {
      if (!userMoved) return; // a fit the code asked for, not the visitor
      const intent = moveIntent.current;
      moveIntent.current = null;
      if (intent === "ignore") return;
      if (intent === "search") {
        searchBounds(b);
        return;
      }
      setPendingBounds(b);
    },
    [searchBounds],
  );

  const current = items.find((i) => i.id === selected) ?? null;

  // Keep the chosen home visible in the list when a marker is tapped.
  useEffect(() => {
    if (!selected) return;
    document.getElementById(`map-item-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div className="flex flex-col lg:grid lg:h-[calc(100dvh-140px)] lg:min-h-[520px] lg:grid-cols-[360px_1fr]">
      <div className="relative order-1 h-[50dvh] min-h-[300px] lg:order-2 lg:h-auto">
        <ListingMap markers={markers} bounds={initialBounds} ariaLabel={tm("ariaLabel")} onSelect={setSelected} selectedId={selected} hoveredId={hovered} onHover={setHovered} onMoveEnd={onMoveEnd} attribution={attribution} focus={focus} fitTo={fitTo} />
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-14">
          {pendingBounds ? (
            <button type="button" onClick={() => searchBounds(pendingBounds)} className={buttonClasses("primary", "md", "pointer-events-auto shadow-lg")}>
              {icons.search}
              {tm("searchThisArea")}
            </button>
          ) : (
            <p className="rounded-md bg-surface/90 px-3 py-1.5 text-meta text-muted shadow">{tm("hint")}</p>
          )}
        </div>
        {current ? (
          <div className="absolute bottom-4 left-4 right-4 hidden max-w-[380px] rounded-md border border-line bg-surface p-4 shadow-lg lg:block">
            <p className="text-[18px] font-[700] tabular">{rentLabel(locale, current.rentMonthly, t("rentUnknown"))}</p>
            <p className="text-meta text-muted">{roomsSizeLabel(locale, current.rooms, current.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") })}</p>
            <p className="mt-1 text-[15px] font-[650]">{current.address}</p>
            <p className="text-meta text-muted">
              {current.areaName ? `${current.areaName}, ` : ""}
              {current.municipalityName} · {current.landlordName}
            </p>
            <Link href={{ pathname: "/home/[slug]", params: { slug: current.slug } }} className={buttonClasses("primary", "md", "mt-3 w-full")}>
              {ta("viewListing")}
            </Link>
          </div>
        ) : null}
      </div>
      <ul className="order-2 max-h-[60dvh] overflow-y-auto border-t border-line bg-surface lg:order-1 lg:max-h-none lg:border-r lg:border-t-0" aria-label={tm("listLabel")}>
        {items.map((i) => (
          <li
            key={i.id}
            id={`map-item-${i.id}`}
            onMouseEnter={() => setHovered(i.id)}
            onMouseLeave={() => setHovered((h) => (h === i.id ? null : h))}
            data-hovered={i.id === hovered ? "true" : undefined}
            className={`flex items-center gap-2 border-b border-hairline pr-3 ${i.id === selected ? "bg-primary-subtle" : i.id === hovered ? "bg-bg" : ""}`}
          >
            <button type="button" onClick={() => choose(i)} onFocus={() => setHovered(i.id)} onBlur={() => setHovered((h) => (h === i.id ? null : h))} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-4 py-3 text-left" aria-pressed={i.id === selected}>
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="text-[16px] font-[700] tabular">{rentLabel(locale, i.rentMonthly, t("rentUnknown"))}</span>
                <span className="text-meta text-muted">{roomsSizeLabel(locale, i.rooms, i.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") })}</span>
              </span>
              <span className="text-[14px] font-[600] text-ink">{i.address}</span>
              <span className="text-meta text-muted">{i.landlordName}</span>
            </button>
            <Link href={{ pathname: "/home/[slug]", params: { slug: i.slug } }} className={buttonClasses("secondary", "sm", "shrink-0")} aria-label={`${ta("viewListing")}: ${i.address}`}>
              {ta("viewListing")}
            </Link>
          </li>
        ))}
        {!items.length ? (
          <li className="px-4 py-5">
            <p className="text-[15px] font-[650] text-ink">{emptyTitle ?? tm("empty")}</p>
            {totalElsewhere > 0 ? (
              <>
                <p className="mt-1 text-[14px] text-ink-2">{tm("emptyBody")}</p>
                <NextLink href={showAllHref} className={buttonClasses("primary", "md", "mt-3 w-full")}>
                  {tm("showAll", { count: totalElsewhere })}
                </NextLink>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-ink-2">{tm("noneAnywhere")}</p>
            )}
            {nearby.length ? (
              <>
                <h2 className="mt-6 text-label font-[650] uppercase tracking-wide text-muted">{tm("nearestTitle")}</h2>
                <ul className="mt-2 flex flex-col">
                  {nearby.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 border-b border-hairline last:border-0">
                      <button type="button" onClick={() => flyTo(i)} className="flex min-w-0 flex-1 flex-col items-start gap-0.5 py-3 pr-2 text-left">
                        <span className="flex w-full items-baseline justify-between gap-3">
                          <span className="text-[16px] font-[700] tabular">{rentLabel(locale, i.rentMonthly, t("rentUnknown"))}</span>
                          <span className="text-meta text-muted">{roomsSizeLabel(locale, i.rooms, i.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") })}</span>
                        </span>
                        <span className="text-[14px] font-[600] text-ink">{i.address}</span>
                        <span className="text-meta text-muted">
                          {i.municipalityName} · {tm("awayFromView", { distance: formatDistance(locale, i.distanceM) })}
                        </span>
                      </button>
                      <Link href={{ pathname: "/home/[slug]", params: { slug: i.slug } }} className={buttonClasses("secondary", "sm", "shrink-0")} aria-label={`${ta("viewListing")}: ${i.address}`}>
                        {ta("viewListing")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

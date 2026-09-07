"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { ListingMap, type MapMarker } from "./listing-map";
import { buttonClasses } from "@/components/ui/button";
import { formatSek } from "@/lib/format";
import { rentLabel, roomsSizeLabel } from "@/lib/listing-display";
import type { SearchResultItem } from "@/lib/queries/listings";

type Props = {
  items: SearchResultItem[];
  query: Record<string, string>;
  initialBounds?: [number, number, number, number];
  attribution?: string;
};

/**
 * Map view: list beside the map, markers carry the rent, and panning the map
 * re-queries by writing the bounds into the URL (so the state is shareable).
 */
export function MapView({ items, query, initialBounds, attribution }: Props) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const ta = useTranslations("actions");
  const tm = useTranslations("map");
  const router = useRouter();
  const pathname = usePathname();
  const [selected, setSelected] = useState<string | null>(items[0]?.id ?? null);
  const [focus, setFocus] = useState<{ lon: number; lat: number; key: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  function choose(i: SearchResultItem) {
    setSelected(i.id);
    if (i.lat !== null && i.lon !== null) setFocus({ lon: i.lon, lat: i.lat, key: Date.now() });
  }
  const [, startTransition] = useTransition();
  const moved = useRef(false);

  const markers: MapMarker[] = useMemo(
    () =>
      items
        .filter((i) => i.lat !== null && i.lon !== null)
        .map((i) => ({ id: i.id, lat: i.lat!, lon: i.lon!, label: i.rentMonthly === null ? t("rentUnknown") : formatSek(locale, i.rentMonthly), slug: i.slug, address: i.address })),
    [items, locale, t],
  );

  const onMoveEnd = useCallback(
    (b: [number, number, number, number]) => {
      if (!moved.current) {
        moved.current = true; // first moveend is the initial fit
        return;
      }
      const bbox = b.map((n) => n.toFixed(4)).join(",");
      startTransition(() => {
        router.replace(`${pathname}?${new URLSearchParams({ ...query, bbox }).toString()}`, { scroll: false });
      });
    },
    [pathname, query, router],
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
        <ListingMap markers={markers} bounds={initialBounds} ariaLabel={tm("ariaLabel")} onSelect={setSelected} selectedId={selected} hoveredId={hovered} onHover={setHovered} onMoveEnd={onMoveEnd} attribution={attribution} focus={focus} />
        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-surface/90 px-3 py-1.5 text-meta text-muted shadow">{tm("hint")}</p>
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
        {!items.length ? <li className="px-4 py-6 text-[14px] text-muted">{tm("empty")}</li> : null}
      </ul>
    </div>
  );
}

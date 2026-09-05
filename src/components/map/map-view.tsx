"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
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
        router.replace({ pathname: pathname as never, query: { ...query, bbox } } as never, { scroll: false });
      });
    },
    [pathname, query, router],
  );

  const current = items.find((i) => i.id === selected) ?? null;

  return (
    <div className="grid h-[calc(100dvh-140px)] min-h-[520px] grid-cols-1 lg:grid-cols-[360px_1fr]">
      <ul className="hidden overflow-y-auto border-r border-line bg-surface lg:block" aria-label={tm("listLabel")}>
        {items.map((i) => (
          <li key={i.id} className={`border-b border-hairline ${i.id === selected ? "bg-primary-subtle" : ""}`}>
            <button type="button" onClick={() => choose(i)} className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-bg" aria-pressed={i.id === selected}>
              <span className="flex w-full items-baseline justify-between gap-3">
                <span className="text-[16px] font-[700] tabular">{rentLabel(locale, i.rentMonthly, t("rentUnknown"))}</span>
                <span className="text-meta text-muted">{roomsSizeLabel(locale, i.rooms, i.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") })}</span>
              </span>
              <span className="text-[14px] font-[600] text-ink">{i.address}</span>
              <span className="text-meta text-muted">{i.landlordName}</span>
            </button>
          </li>
        ))}
        {!items.length ? <li className="px-4 py-6 text-[14px] text-muted">{tm("empty")}</li> : null}
      </ul>
      <div className="relative">
        <ListingMap markers={markers} bounds={initialBounds} ariaLabel={tm("ariaLabel")} onSelect={setSelected} selectedId={selected} onMoveEnd={onMoveEnd} attribution={attribution} focus={focus} />
        <p className="pointer-events-none absolute left-3 top-3 rounded-md bg-surface/90 px-3 py-1.5 text-meta text-muted shadow">{tm("hint")}</p>
        {current ? (
          <div className="absolute bottom-4 left-4 right-4 max-w-[380px] rounded-md border border-line bg-surface p-4 shadow-lg">
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
    </div>
  );
}

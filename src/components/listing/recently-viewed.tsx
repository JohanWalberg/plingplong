"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { ListingImage } from "./listing-image";
import { rentLabel, roomsSizeLabel } from "@/lib/listing-display";
import { clearRecent, readRecent, recordRecent, type RecentHome } from "@/lib/recent";

/** Placed on the listing page: remembers the visit. Renders nothing. */
export function RecordRecent(props: Omit<RecentHome, "viewedAt">) {
  useEffect(() => {
    recordRecent(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.slug]);
  return null;
}

/**
 * Row of recently viewed homes from browser storage. Hidden entirely when
 * there is nothing to show, so first-time visitors never see an empty box.
 * `exclude` keeps the current listing out of its own row.
 */
export function RecentlyViewed({ exclude, className = "" }: { exclude?: string; className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const th = useTranslations("home");
  const [items, setItems] = useState<RecentHome[]>([]);
  useEffect(() => setItems(readRecent().filter((r) => r.slug !== exclude)), [exclude]);
  if (!items.length) return null;
  return (
    <section aria-labelledby="recent-title" className={className}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent-title" className="text-h2">
          {th("recentTitle")}
        </h2>
        <button
          type="button"
          onClick={() => {
            clearRecent();
            setItems([]);
          }}
          className="text-[14px] font-[650] text-ink-2 hover:text-ink"
        >
          {th("recentClear")}
        </button>
      </div>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {items.map((r) => (
          <li key={r.slug} className="w-[240px] shrink-0 list-none">
            <article className="relative flex h-full flex-col overflow-hidden rounded-md border border-line bg-surface transition-shadow hover:shadow-[0_2px_8px_rgba(26,24,21,.08)]">
              <ListingImage src={r.imageUrl} address={r.address} noImage={t("noImage")} className="h-[110px] w-full" sizes="240px" />
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="text-[16px] font-[700] leading-none tabular text-ink">{rentLabel(locale, r.rentMonthly, t("rentUnknown"))}</p>
                <h3 className="text-[14.5px] font-[650] leading-snug">
                  <Link href={{ pathname: "/home/[slug]", params: { slug: r.slug } }} className="text-ink after:absolute after:inset-0 hover:text-ink hover:no-underline">
                    {r.address}
                  </Link>
                </h3>
                <p className="truncate text-meta text-muted">
                  {r.place} · {roomsSizeLabel(locale, r.rooms, r.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") })}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { freshnessMessage } from "@/lib/listing-display";
import { icons } from "@/components/ui/misc";
import type { Locale } from "@/i18n/routing";

/**
 * Renders "Checked N minutes ago" from a server timestamp and re-renders every
 * minute. The timestamp is the truth; the wording is computed on the client so
 * cached pages never show stale freshness copy.
 */
export function Freshness({ lastCheckedAt, prefix = "checked", className = "" }: { lastCheckedAt: Date | string | null; prefix?: "checked" | "last"; className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("freshness");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const date = lastCheckedAt ? new Date(lastCheckedAt) : null;
  const m = freshnessMessage(locale, date, now);
  // "last" prefix uses the "Senast kontrollerad …" phrasing for detail pages.
  const key = prefix === "last" && m.key === "todayAt" ? "lastCheckedTodayAt" : m.key;
  return (
    <span className={`inline-flex items-center gap-1.5 text-meta text-muted ${className}`}>
      {icons.refresh}
      <time dateTime={date?.toISOString()} suppressHydrationWarning>
        {t(key, m.values)}
      </time>
    </span>
  );
}

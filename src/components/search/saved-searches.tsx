"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { readSavedSearches, writeSavedSearches, type SavedSearch } from "@/lib/saved";

export function SavedSearches() {
  const t = useTranslations("navigation");
  const tc = useTranslations("common");
  const [items, setItems] = useState<SavedSearch[]>([]);
  useEffect(() => setItems(readSavedSearches()), []);
  function remove(href: string) {
    const next = items.filter((i) => i.href !== href);
    writeSavedSearches(next);
    setItems(next);
  }
  if (!items.length) return null;
  return (
    <section className="mt-6" aria-labelledby="saved-searches">
      <h2 id="saved-searches" className="text-h2">
        {t("saved")}
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-hairline rounded-md border border-line bg-surface">
        {items.map((i) => (
          <li key={i.href} className="flex items-center justify-between gap-3 px-4 py-2">
            <a href={i.href} className="min-h-touch flex items-center font-[600]">
              {i.label}
            </a>
            <button type="button" onClick={() => remove(i.href)} className="min-h-touch px-2 text-[13px] text-muted hover:text-ink">
              {tc("close")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

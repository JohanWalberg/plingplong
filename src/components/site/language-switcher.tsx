"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Switches locale while staying on the same entity and keeping the query
 * string (search and filter state). Slugs that differ per locale are passed
 * in via `alternates` by the page (e.g. municipality pages).
 */
type SwitcherProps = { alternates?: Partial<Record<Locale, Record<string, string>>>; variant?: "light" | "dark" | "text" };

/** Suspense wrapper: useSearchParams needs a boundary on statically rendered pages. */
export function LanguageSwitcher(props: SwitcherProps) {
  return (
    <Suspense fallback={null}>
      <LanguageSwitcherInner {...props} />
    </Suspense>
  );
}

function LanguageSwitcherInner({ alternates, variant = "light" }: SwitcherProps) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const t = useTranslations("common");

  function switchTo(next: Locale) {
    if (next === locale) return;
    const query = Object.fromEntries(search.entries());
    const nextParams = { ...(params as Record<string, string>), ...(alternates?.[next] ?? {}) };
    router.replace({ pathname, params: nextParams, query } as Parameters<typeof router.replace>[0], { locale: next });
  }

  if (variant === "text") {
    return (
      <p className="flex items-center gap-2 text-[13px]">
        {routing.locales.map((l, i) => (
          <span key={l} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true" className="text-dark-muted">|</span> : null}
            <button
              type="button"
              onClick={() => switchTo(l)}
              aria-current={l === locale ? "true" : undefined}
              lang={l}
              className={`min-h-touch px-1 ${l === locale ? "font-[650] text-dark-text" : "text-dark-muted hover:text-dark-text"}`}
            >
              {l === "sv" ? t("swedish") : t("english")}
            </button>
          </span>
        ))}
      </p>
    );
  }

  const dark = variant === "dark";
  return (
    <div role="group" aria-label={t("language")} className={`flex overflow-hidden rounded-md border ${dark ? "border-dark-3" : "border-line-strong"}`}>
      {routing.locales.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={active}
            onClick={() => switchTo(l)}
            className={`min-h-9 min-w-11 px-2.5 text-[12.5px] font-[650] uppercase tracking-wide ${
              active ? (dark ? "bg-dark-text text-dark" : "bg-primary text-white") : dark ? "text-dark-muted hover:text-dark-text" : "text-muted hover:text-ink"
            }`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

import type { Metadata } from "next";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_SITE_URL) throw new Error("NEXT_PUBLIC_SITE_URL must be set in production (canonicals, hreflang, sitemap and share cards use it)");
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type Href = Parameters<typeof getPathname>[0]["href"];

/** Canonical + hreflang alternates for a page, resolving translated pathnames per locale. */
export function alternatesFor(locale: Locale, hrefFor: (l: Locale) => Href): NonNullable<Metadata["alternates"]> {
  const url = (l: Locale) => SITE_URL + getPathname({ locale: l, href: hrefFor(l) as never });
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[l] = url(l);
  languages["x-default"] = url(routing.defaultLocale);
  return { canonical: url(locale), languages };
}

export function absoluteUrl(locale: Locale, href: Href) {
  return SITE_URL + getPathname({ locale, href: href as never });
}

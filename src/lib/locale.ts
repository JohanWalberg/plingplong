import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";

/** Validates the `[locale]` route param, enables static rendering, returns it typed. */
export async function resolveLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

export function toLocale(value: string | undefined | null): Locale {
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

export const intlLocale = (locale: Locale) => (locale === "sv" ? "sv-SE" : "en-GB");

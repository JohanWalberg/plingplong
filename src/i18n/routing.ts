import { defineRouting } from "next-intl/routing";

export const locales = ["sv", "en"] as const;
export type Locale = (typeof locales)[number];

/**
 * Translated pathnames. The key is the internal route; the value is the
 * public path per locale. Dynamic segments stay identical across locales.
 */
export const pathnames = {
  "/": "/",
  "/homes": { sv: "/bostader", en: "/homes" },
  "/homes/[place]": { sv: "/bostader/[place]", en: "/homes/[place]" },
  "/homes/[place]/[area]": { sv: "/bostader/[place]/[area]", en: "/homes/[place]/[area]" },
  "/home/[slug]": { sv: "/bostad/[slug]", en: "/home/[slug]" },
  "/map": { sv: "/karta", en: "/map" },
  "/municipalities": { sv: "/kommuner", en: "/municipalities" },
  "/municipalities/[slug]": { sv: "/kommuner/[slug]", en: "/municipalities/[slug]" },
  "/landlords": { sv: "/hyresvardar", en: "/landlords" },
  "/landlords/[slug]": { sv: "/hyresvardar/[slug]", en: "/landlords/[slug]" },
  "/saved": { sv: "/sparade", en: "/saved" },
  "/how-it-works": { sv: "/sa-fungerar-det", en: "/how-it-works" },
  "/coverage": { sv: "/tackning", en: "/coverage" },
  "/faq": { sv: "/fragor-och-svar", en: "/faq" },
  "/contact": { sv: "/kontakt", en: "/contact" },
  "/about-collection": { sv: "/om-insamling", en: "/about-collection" },
  "/privacy": { sv: "/personuppgifter", en: "/privacy" },
  "/cookies": "/cookies",

  "/for-landlords": { sv: "/for-hyresvarder", en: "/for-landlords" },
  "/for-landlords/create-account": { sv: "/for-hyresvarder/skapa-konto", en: "/for-landlords/create-account" },
  "/portal/sign-in": { sv: "/portal/logga-in", en: "/portal/sign-in" },
  "/portal/forgot-password": { sv: "/portal/glomt-losenord", en: "/portal/forgot-password" },
  "/portal/reset-password": { sv: "/portal/nytt-losenord", en: "/portal/reset-password" },
  "/portal/invite/[token]": { sv: "/portal/inbjudan/[token]", en: "/portal/invite/[token]" },
  "/portal/homes": { sv: "/portal/bostader", en: "/portal/homes" },
  "/portal/homes/new": { sv: "/portal/bostader/ny", en: "/portal/homes/new" },
  "/portal/homes/[id]": { sv: "/portal/bostader/[id]", en: "/portal/homes/[id]" },
  "/portal/homes/[id]/edit": { sv: "/portal/bostader/[id]/redigera", en: "/portal/homes/[id]/edit" },
  "/portal/homes/[id]/published": { sv: "/portal/bostader/[id]/publicerad", en: "/portal/homes/[id]/published" },
  "/portal/sources": { sv: "/portal/kallor", en: "/portal/sources" },
  "/portal/sources/new": { sv: "/portal/kallor/ny", en: "/portal/sources/new" },
  "/portal/sources/[id]": { sv: "/portal/kallor/[id]", en: "/portal/sources/[id]" },
  "/portal/statistics": { sv: "/portal/statistik", en: "/portal/statistics" },
  "/portal/account": { sv: "/portal/konto", en: "/portal/account" },
  "/portal/pending": { sv: "/portal/vantar", en: "/portal/pending" },

  "/admin": "/admin",
  "/admin/sign-in": { sv: "/admin/logga-in", en: "/admin/sign-in" },
  "/admin/sources": { sv: "/admin/kallor", en: "/admin/sources" },
  "/admin/sources/new": { sv: "/admin/kallor/ny", en: "/admin/sources/new" },
  "/admin/sources/[id]": { sv: "/admin/kallor/[id]", en: "/admin/sources/[id]" },
  "/admin/landlords": { sv: "/admin/hyresvardar", en: "/admin/landlords" },
  "/admin/landlords/new": { sv: "/admin/hyresvardar/ny", en: "/admin/landlords/new" },
  "/admin/landlords/[id]": { sv: "/admin/hyresvardar/[id]", en: "/admin/landlords/[id]" },
  "/admin/applications": { sv: "/admin/hyresvardar/ansokningar", en: "/admin/landlords/applications" },
  "/admin/listings": { sv: "/admin/bostader", en: "/admin/listings" },
  "/admin/listings/[id]": { sv: "/admin/bostader/[id]", en: "/admin/listings/[id]" },
  "/admin/duplicates": { sv: "/admin/dubbletter", en: "/admin/duplicates" },
  "/admin/coverage": { sv: "/admin/tackning", en: "/admin/coverage" },
  "/admin/settings": { sv: "/admin/installningar", en: "/admin/settings" },
} as const;

export const routing = defineRouting({
  locales,
  defaultLocale: "sv",
  localePrefix: "always",
  pathnames,
});

export type AppPathname = keyof typeof pathnames;

/** Pathnames without dynamic segments, usable as plain `href` values. */
export type StaticPathname = Exclude<AppPathname, `${string}[${string}`>;

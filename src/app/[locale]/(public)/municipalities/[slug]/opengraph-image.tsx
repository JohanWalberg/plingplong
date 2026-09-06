import { getTranslations } from "next-intl/server";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { resolveLocale } from "@/lib/locale";
import { landlordCountsFor, municipalityStats } from "@/lib/queries/listings";
import { countyName, findMunicipalityBySlug, municipalityName } from "@/lib/queries/places";
import { formatNumber } from "@/lib/format";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const [muni, t] = await Promise.all([findMunicipalityBySlug(slug), getTranslations({ locale, namespace: "municipality" })]);
  if (!muni) return ogCard({ kicker: t("crumbRoot"), title: slug });
  const [stats, landlords] = await Promise.all([municipalityStats(muni.id), landlordCountsFor(muni.id)]);
  const name = municipalityName(muni, locale);
  return ogCard({
    kicker: t("crumbRoot"),
    title: t("title", { place: name }),
    facts: [`${formatNumber(locale, stats.listings)} ${t("statListings").toLowerCase()}`, `${formatNumber(locale, landlords.length)} ${t("statLandlords").toLowerCase()}`],
    footer: countyName(muni, locale),
  });
}

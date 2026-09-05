import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SearchPage } from "@/components/search/search-page";
import { resolveLocale } from "@/lib/locale";
import { findMunicipalityBySlug, municipalityName } from "@/lib/queries/places";
import type { RawSearchParams } from "@/lib/search-params";

type Props = { params: Promise<{ locale: string; place: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { place } = await params;
  const locale = await resolveLocale(params);
  const muni = await findMunicipalityBySlug(place);
  const t = await getTranslations({ locale, namespace: "municipality" });
  return { title: muni ? t("title", { place: municipalityName(muni, locale) }) : undefined, robots: { index: false } };
}

export default async function PlacePage({ params, searchParams }: Props) {
  const { place } = await params;
  const locale = await resolveLocale(params);
  return <SearchPage locale={locale} placeSlug={place} searchParams={await searchParams} />;
}

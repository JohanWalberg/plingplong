import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SearchPage } from "@/components/search/search-page";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { intentBySlug, intentSlug } from "@/lib/intents";
import { findMunicipalityBySlug, municipalityName, municipalitySlug } from "@/lib/queries/places";
import type { RawSearchParams } from "@/lib/search-params";

type Props = { params: Promise<{ locale: string; place: string; area: string }>; searchParams: Promise<RawSearchParams> };

export const revalidate = 300;

/** Area searches stay out of the index; the intent landing pages in the same slot are what search engines get. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { place, area } = await params;
  const locale = await resolveLocale(params);
  const intent = intentBySlug(area, locale);
  if (!intent) return { robots: { index: false } };
  const muni = await findMunicipalityBySlug(place);
  if (!muni) return { robots: { index: false } };
  const t = await getTranslations({ locale, namespace: "intents" });
  const name = municipalityName(muni, locale);
  return {
    title: t(`${intent}Title`, { place: name }),
    description: t(`${intent}Intro`, { place: name }),
    alternates: alternatesFor(locale, (l) => ({ pathname: "/homes/[place]/[area]", params: { place: municipalitySlug(muni, l), area: intentSlug(intent, l) } })),
  };
}

export default async function AreaPage({ params, searchParams }: Props) {
  const { place, area } = await params;
  const locale = await resolveLocale(params);
  return <SearchPage locale={locale} placeSlug={place} areaSlug={area} searchParams={await searchParams} />;
}

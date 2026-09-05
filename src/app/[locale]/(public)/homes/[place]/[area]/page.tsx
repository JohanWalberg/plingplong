import type { Metadata } from "next";
import { SearchPage } from "@/components/search/search-page";
import { resolveLocale } from "@/lib/locale";
import type { RawSearchParams } from "@/lib/search-params";

type Props = { params: Promise<{ locale: string; place: string; area: string }>; searchParams: Promise<RawSearchParams> };

export const metadata: Metadata = { robots: { index: false } };

export default async function AreaPage({ params, searchParams }: Props) {
  const { place, area } = await params;
  const locale = await resolveLocale(params);
  return <SearchPage locale={locale} placeSlug={place} areaSlug={area} searchParams={await searchParams} />;
}

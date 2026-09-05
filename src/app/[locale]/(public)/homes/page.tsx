import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SearchPage } from "@/components/search/search-page";
import { resolveLocale } from "@/lib/locale";
import type { RawSearchParams } from "@/lib/search-params";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RawSearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "navigation" });
  return { title: t("search") };
}

export default async function HomesPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  return <SearchPage locale={locale} searchParams={await searchParams} />;
}

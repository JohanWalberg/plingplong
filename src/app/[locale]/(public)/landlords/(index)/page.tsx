import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { LandlordDirectory } from "@/components/landlord/landlord-directory";
import { landlordDirectory } from "@/lib/queries/landlords";
import { listMunicipalities, municipalityName } from "@/lib/queries/places";

// Rendered at build time and refreshed every five minutes; listing changes from
// the portal and admin clear it immediately through invalidateListingCaches().
export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "landlord" });
  return { title: t("indexTitle"), alternates: alternatesFor(locale, () => "/landlords") };
}

export default async function LandlordsPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("landlord");
  const [entries, munis] = await Promise.all([landlordDirectory(), listMunicipalities()]);
  // Only municipalities some landlord actually operates in, so the filter never offers an empty answer.
  const used = new Set(entries.flatMap((e) => e.municipalityIds));
  const municipalities = munis.filter((m) => used.has(m.id)).map((m) => ({ id: m.id, name: municipalityName(m, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale));

  return (
    <>
      <SiteHeader active="landlords" />
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{t("indexTitle")}</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">{t("indexIntro")}</p>
        <LandlordDirectory entries={entries} municipalities={municipalities} />
      </main>
    </>
  );
}

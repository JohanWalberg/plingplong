import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage, Section } from "@/components/site/static-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("privacyTitle"), alternates: alternatesFor(locale, () => "/privacy") };
}

export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  return (
    <StaticPage title={t("privacyTitle")} intro={t("privacyIntro")}>
      <Section title={t("privacyLandlordsTitle")}>
        <p>{t("privacyLandlordsBody")}</p>
        <p>{t("privacyRetention")}</p>
      </Section>
      <Section title={t("privacyListingsTitle")}>
        <p>{t("privacyListingsBody")}</p>
      </Section>
      <p>{t("privacyContact", { email: t("contactEmail") })}</p>
    </StaticPage>
  );
}

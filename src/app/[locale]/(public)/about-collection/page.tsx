import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage, Section } from "@/components/site/static-page";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("collectionTitle"), alternates: alternatesFor(locale, () => "/about-collection") };
}

export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  void Link;
  void Section;
  return (
    <StaticPage title={t("collectionTitle")} intro={t("collectionIntro")}>
      <Section title={t("collectionWhatTitle")}>
        <p>{t("collectionWhatBody")}</p>
      </Section>
      <Section title={t("collectionHowTitle")}>
        <p>{t("collectionHowBody")}</p>
      </Section>
      <Section title={t("collectionRemovalTitle")}>
        <p>{t("collectionRemovalBody")}</p>
        <p>
          <a href={`mailto:${t("contactEmail")}`}>{t("contactEmail")}</a>
        </p>
      </Section>
      <Section title={t("collectionRetentionTitle")}>
        <p>{t("collectionRetentionBody")}</p>
      </Section>
    </StaticPage>
  );
}

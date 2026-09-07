import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage, Section } from "@/components/site/static-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("cookiesTitle"), alternates: alternatesFor(locale, () => "/cookies") };
}

export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  return (
    <StaticPage title={t("cookiesTitle")} intro={t("cookiesIntro")}>
      <Section title={t("cookiesNecessaryTitle")}>
        <p>{t("cookiesNecessaryBody")}</p>
      </Section>
    </StaticPage>
  );
}

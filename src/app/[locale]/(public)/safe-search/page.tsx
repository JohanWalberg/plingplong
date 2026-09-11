import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage, Section } from "@/components/site/static-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("safeTitle"), description: t("safeIntro"), alternates: alternatesFor(locale, () => "/safe-search") };
}

/** The fraud guide every listing links to: what a genuine landlord never asks for. */
export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  return (
    <StaticPage title={t("safeTitle")} intro={t("safeIntro")}>
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <Section key={n} title={t(`safe${n}Title`)}>
          <p>{t(`safe${n}Body`)}</p>
        </Section>
      ))}
      <Section title={t("safe6Title")}>
        <p>{t("safe6Body", { email: t("contactEmail") })}</p>
      </Section>
    </StaticPage>
  );
}

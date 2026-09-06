import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage, Section } from "@/components/site/static-page";
import { Link } from "@/i18n/navigation";
import { formatDateLong } from "@/lib/format";

type Props = { params: Promise<{ locale: string }> };
const UPDATED = "2026-09-06";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("termsTitle"), alternates: alternatesFor(locale, () => "/terms") };
}

export default async function TermsPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("pages");
  const tf = await getTranslations("footer");
  return (
    <StaticPage title={t("termsTitle")} intro={t("termsIntro")}>
      {([1, 2, 3, 4, 5, 6] as const).map((n) => (
        <Section key={n} title={t(`terms${n}Title`)}>
          <p>{t(`terms${n}Body`)}</p>
          {n === 5 ? (
            <p>
              <Link href="/privacy">{tf("privacy")}</Link>
            </p>
          ) : null}
        </Section>
      ))}
      <p className="text-meta text-muted">{t("termsUpdated", { date: formatDateLong(locale, UPDATED) })}</p>
    </StaticPage>
  );
}

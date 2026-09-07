import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage } from "@/components/site/static-page";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("contactTitle"), alternates: alternatesFor(locale, () => "/contact") };
}

export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  return (
    <StaticPage title={t("contactTitle")} intro={t("contactIntro")}>
      <p>
        <a href={`mailto:${t("contactEmail")}`} className="text-[18px] font-[650]">
          {t("contactEmail")}
        </a>
      </p>
      <p>
        <Link href="/for-landlords">{t("contactLandlords")}</Link>
      </p>
    </StaticPage>
  );
}

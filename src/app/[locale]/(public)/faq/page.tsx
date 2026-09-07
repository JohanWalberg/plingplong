import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { StaticPage } from "@/components/site/static-page";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pages" });
  return { title: t("faqTitle"), alternates: alternatesFor(locale, () => "/faq") };
}

export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  return (
    <StaticPage title={t("faqTitle")}>
      <dl className="flex flex-col gap-5">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <div key={n}>
            <dt className="text-h3 text-ink">{t(`faq${n}Q`)}</dt>
            <dd className="mt-1">{t(`faq${n}A`)}</dd>
          </div>
        ))}
      </dl>
    </StaticPage>
  );
}

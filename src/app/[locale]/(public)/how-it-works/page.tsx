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
  return { title: t("howItWorksTitle"), alternates: alternatesFor(locale, () => "/how-it-works") };
}

export default async function Page({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("pages");
  void Link;
  void Section;
  return (
    <StaticPage title={t("howItWorksTitle")} intro={t("howItWorksIntro")}>
      <ol className="flex flex-col gap-6">
        {([1, 2, 3] as const).map((n) => (
          <li key={n} className="flex gap-4">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-[13px] font-[700] tabular text-ink">
              {n}
            </span>
            <div>
              <h2 className="text-h3 text-ink">{t(`howStep${n}Title`)}</h2>
              <p className="mt-1">{t(`howStep${n}Body`)}</p>
            </div>
          </li>
        ))}
      </ol>
    </StaticPage>
  );
}

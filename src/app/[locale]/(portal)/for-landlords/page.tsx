import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { PortalPublicShell } from "@/components/portal/portal-shell";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, icons } from "@/components/ui/misc";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "navigation" });
  return { title: t("forLandlords"), alternates: alternatesFor(locale, () => "/for-landlords") };
}

export default async function ForLandlordsPage({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("portal.landing");
  return (
    <PortalPublicShell wide>
      <section className="py-6 sm:py-10">
        <h1 className="max-w-[20ch] font-serif text-[40px] leading-[1.08] sm:text-display">{t("heroTitle")}</h1>
        <p className="mt-4 max-w-[62ch] text-[17px] text-ink-2">{t("heroSub")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/for-landlords/create-account" className={buttonClasses("primary", "lg")}>
            {t("cta")}
          </Link>
          <Link href="/portal/sign-in" className={buttonClasses("secondary", "lg")}>
            {t("navLogin")}
          </Link>
        </div>
        <p className="mt-3 text-[14px] text-muted">{t("freeNote")}</p>
      </section>

      <section className="mt-8" aria-labelledby="paths">
        <h2 id="paths" className="text-h2">
          {t("pathsTitle")}
        </h2>
        <p className="mt-1 text-ink-2">{t("pathsSub")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {(["path1", "path2"] as const).map((p) => (
            <Card key={p} className="flex flex-col gap-3 p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-h3">{t(`${p}Title`)}</h3>
                <Badge tone={p === "path1" ? "info" : "quiet"}>{t(`${p}Tag`)}</Badge>
              </div>
              <p className="text-[14.5px] text-ink-2">{t(`${p}Body`)}</p>
              <ul className="flex flex-col gap-1.5 text-[14.5px]">
                {([1, 2, 3] as const).map((n) => (
                  <li key={n} className="flex items-start gap-2">
                    <span className="mt-1 text-success">{icons.check}</span>
                    {t(`${p}Point${n}`)}
                  </li>
                ))}
              </ul>
              <Link href="/for-landlords/create-account" className={buttonClasses("secondary", "md", "mt-auto self-start")}>
                {t(`${p}Cta`)}
              </Link>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="promises">
        <h2 id="promises" className="text-h2">
          {t("promiseTitle")}
        </h2>
        <dl className="mt-4 grid gap-6 md:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <div key={n}>
              <dt className="text-h3">{t(`promise${n}Title`)}</dt>
              <dd className="mt-1 text-[14.5px] text-ink-2">{t(`promise${n}Body`)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PortalPublicShell>
  );
}

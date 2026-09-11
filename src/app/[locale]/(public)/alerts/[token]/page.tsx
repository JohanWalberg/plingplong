import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { SiteHeader } from "@/components/site/header";
import { Card } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { findAlert } from "@/lib/queries/alerts";
import { alertSearchHref } from "@/worker/alerts";
import { AlertControls } from "@/components/search/alert-controls";

type Props = { params: Promise<{ locale: string; token: string }> };
export const metadata: Metadata = { robots: { index: false } };
export const dynamic = "force-dynamic";

/** The link in every alert mail: confirms a new alert, or ends an active one. */
export default async function AlertPage({ params }: Props) {
  const { token } = await params;
  const locale = await resolveLocale(params);
  const t = await getTranslations("alerts");
  const alert = await findAlert(token);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[640px] px-4 py-12 sm:px-6">
        <Card className="p-6 sm:p-8">
          {!alert ? (
            <>
              <h1 className="font-serif text-[30px] leading-tight">{t("invalidTitle")}</h1>
              <p className="mt-3 text-ink-2">{t("invalidBody")}</p>
              <p className="mt-6">
                <Link href="/homes" className={buttonClasses("primary")}>
                  {t("toSearch")}
                </Link>
              </p>
            </>
          ) : (
            <AlertControls
              token={token}
              locale={locale}
              label={alert.label}
              email={alert.email}
              confirmed={!!alert.confirmedAt}
              searchHref={alertSearchHref({ query: alert.query, municipality: alert.municipality, area: alert.area }, locale)}
            />
          )}
        </Card>
      </main>
    </>
  );
}

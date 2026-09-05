import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { getLandlord } from "@/lib/access";
import { redirect } from "@/i18n/navigation";
import { PortalPublicShell } from "@/components/portal/portal-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, Callout, icons } from "@/components/ui/misc";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("portalTitle"), robots: { index: false } };
}

export default async function PortalSignInPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const sp = await searchParams;
  if (!sp.expired && !sp.denied) {
    const me = await getLandlord();
    if (me) redirect({ href: "/portal/homes", locale });
  }
  const t = await getTranslations("auth");
  return (
    <PortalPublicShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-6 sm:p-8">
          <h1 className="font-serif text-[32px] leading-tight">{t("portalTitle")}</h1>
          <p className="mt-2 text-ink-2">{t("portalSub")}</p>
          <div className="mt-6 max-w-[420px]">
            <SignInForm surface="portal" />
          </div>
          <div className="mt-6 rounded-md border border-line bg-bg p-4">
            <p className="flex items-center gap-2 text-[14.5px] font-[650]">
              <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded bg-ink text-[10px] font-[800] text-white">
                BID
              </span>
              {t("bankIdTitle")}
            </p>
            <p className="mt-1 text-[13.5px] text-muted">{t("bankIdSoon")}</p>
          </div>
          <p className="mt-6 text-[14px] text-ink-2">
            {t("noAccount")}{" "}
            <Link href="/for-landlords/create-account" className="font-[650]">
              {t("createAccount")}
            </Link>
          </p>
        </Card>
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-h3">{t("whyReviewTitle")}</h2>
            <p className="mt-2 text-[14px] text-ink-2">{t("whyReviewBody")}</p>
          </Card>
          <Card className="p-5">
            <h2 className="text-h3">{t("pendingTitle")}</h2>
            <p className="mt-2 text-[14px] text-ink-2">{t("pendingBody")}</p>
          </Card>
          {sp.denied ? <Callout tone="warning" icon={icons.warn}>{t("noAccess")}</Callout> : null}
        </aside>
      </div>
    </PortalPublicShell>
  );
}

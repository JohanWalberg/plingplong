import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { getStaff } from "@/lib/access";
import { redirect } from "@/i18n/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Logo } from "@/components/ui/logo";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminSignInPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const sp = await searchParams;
  if (!sp.expired && !sp.denied) {
    const staff = await getStaff();
    if (staff) redirect({ href: "/admin", locale });
  }
  const t = await getTranslations("auth");
  const tc = await getTranslations("common");
  return (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-dark px-4 py-12 text-dark-text">
      <div className="w-full max-w-[440px]">
        <p className="flex items-center justify-center gap-2.5">
          <Logo tone="dark" />
          <span className="text-[13px] text-dark-muted">{tc("admin")}</span>
        </p>
        <div className="mt-6 rounded-lg bg-surface p-6 text-ink shadow-xl sm:p-8">
          <h1 className="font-serif text-[30px] leading-tight">{t("adminTitle")}</h1>
          <p className="mt-1 text-[14.5px] text-ink-2">{t("adminSub")}</p>
          <div className="mt-6">
            <SignInForm surface="admin" />
          </div>
          <p className="mt-5 text-[13px] text-muted">{t("adminNote")}</p>
          <p className="mt-1 text-[13px] text-muted">{t("ssoSoon")}</p>
        </div>
        <dl className="mt-6 flex flex-col gap-2 text-[13.5px]">
          {(["Support", "Lead", "Engineer"] as const).map((r) => (
            <div key={r} className="flex gap-3">
              <dt className="w-24 shrink-0 font-[650] text-dark-text">{t(`role${r}`)}</dt>
              <dd className="text-dark-muted">{t(`role${r}Body`)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-center text-[12.5px] text-dark-muted">{t("adminHidden")}</p>
      </div>
    </main>
  );
}

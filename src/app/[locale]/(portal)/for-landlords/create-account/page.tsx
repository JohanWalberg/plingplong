import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { PortalPublicShell } from "@/components/portal/portal-shell";
import { SignupForm } from "@/components/portal/signup-form";
import { Card } from "@/components/ui/misc";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "portal.signup" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CreateAccountPage({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("portal.signup");
  const steps = [t("step1"), t("step2"), t("step3")];
  return (
    <PortalPublicShell wide>
      <ol className="flex flex-wrap gap-4 text-[13.5px]">
        {steps.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 ${i === 0 ? "font-[650] text-ink" : "text-muted"}`}>
            <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-[12px] ${i === 0 ? "border-ink bg-ink text-white" : "border-line-strong"}`} aria-hidden="true">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-6 sm:p-8">
          <h1 className="font-serif text-[32px] leading-tight">{t("title")}</h1>
          <p className="mt-2 text-ink-2">{t("sub")}</p>
          <div className="mt-6">
            <SignupForm />
          </div>
        </Card>
        <aside className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-h3">{t("statusTitle")}</h2>
            <p className="mt-2 text-[14px] text-ink-2">{t("statusBody")}</p>
            <ol className="mt-4 flex flex-col gap-3">
              {([1, 2, 3] as const).map((n) => (
                <li key={n} className="flex gap-3 text-[14px]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] text-muted" aria-hidden="true">
                    {n}
                  </span>
                  <span>
                    <span className="block font-[650]">{t(`review${n}`)}</span>
                    <span className="text-muted">{t(`review${n}Body`)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="p-5">
            <h2 className="text-h3">{t("whyTitle")}</h2>
            <p className="mt-2 text-[14px] text-ink-2">{t("whyBody")}</p>
          </Card>
        </aside>
      </div>
    </PortalPublicShell>
  );
}

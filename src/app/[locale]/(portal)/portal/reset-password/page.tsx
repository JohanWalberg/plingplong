import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { PortalPublicShell } from "@/components/portal/portal-shell";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Card } from "@/components/ui/misc";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function ResetPage({ params }: Props) {
  await resolveLocale(params);
  const t = await getTranslations("auth");
  return (
    <PortalPublicShell>
      <Card className="mx-auto max-w-[520px] p-6 sm:p-8">
        <h1 className="font-serif text-[30px] leading-tight">{t("resetTitle")}</h1>
        <div className="mt-5">
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </Card>
    </PortalPublicShell>
  );
}

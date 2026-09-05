import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { db, schema } from "@/db";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { getLandlord, getViewer } from "@/lib/access";
import { PortalPublicShell } from "@/components/portal/portal-shell";
import { SignOutButton } from "@/components/auth/sign-in-form";
import { Badge } from "@/components/ui/badge";
import { Card, Callout } from "@/components/ui/misc";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

/** Signed in but not yet a member of any landlord: show the application status. */
export default async function PendingPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await getViewer();
  if (!viewer) redirect({ href: "/portal/sign-in", locale });
  const member = await getLandlord();
  if (member) redirect({ href: "/portal/homes", locale });
  const app = await db.query.landlordApplication.findFirst({ where: eq(schema.landlordApplication.userId, viewer!.userId), orderBy: (a, { desc }) => [desc(a.createdAt)] });
  const t = await getTranslations("portal.signup");
  const ta = await getTranslations("auth");
  const status = app?.status ?? "pending";

  return (
    <PortalPublicShell>
      <Card className="mx-auto max-w-[640px] p-6 sm:p-8">
        {status === "rejected" ? (
          <Callout tone="error">{ta("rejected")}</Callout>
        ) : status === "needs_info" ? (
          <>
            <Badge tone="soon" icon="clock">
              {t("statusTag")}
            </Badge>
            <h1 className="mt-3 font-serif text-[30px] leading-tight">{t("needsInfoTitle")}</h1>
            <p className="mt-2 text-ink-2">{t("needsInfoBody", { email: app?.contactEmail ?? viewer!.email })}</p>
          </>
        ) : (
          <>
            <Badge tone="soon" icon="clock">
              {t("statusTag")}
            </Badge>
            <h1 className="mt-3 font-serif text-[30px] leading-tight">{t("statusTitle")}</h1>
            <p className="mt-2 text-ink-2">{t("statusBody")}</p>
          </>
        )}
        <ol className="mt-6 flex flex-col gap-3 border-t border-hairline pt-6">
          {([1, 2, 3] as const).map((n) => {
            const state = n === 1 ? "done" : n === 2 ? (status === "approved" ? "done" : "active") : status === "approved" ? "done" : "todo";
            return (
              <li key={n} className="flex gap-3 text-[14.5px]">
                <span aria-hidden="true" className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${state === "done" ? "bg-success text-white" : state === "active" ? "border-2 border-warning text-warning" : "border border-line-strong text-muted"}`}>
                  {state === "done" ? "✓" : n}
                </span>
                <span>
                  <span className="block font-[650]">{t(`review${n}`)}</span>
                  <span className="text-muted">{t(`review${n}Body`)}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-[14px] text-muted">
          {viewer!.email} · <SignOutButton className="text-primary" />
        </p>
      </Card>
    </PortalPublicShell>
  );
}

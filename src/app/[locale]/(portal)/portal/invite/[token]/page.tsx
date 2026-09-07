import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { findInvitation } from "@/lib/queries/invitations";
import { PortalPublicShell } from "@/components/portal/portal-shell";
import { AcceptInviteForm } from "@/components/portal/accept-invite-form";
import { Card, Callout } from "@/components/ui/misc";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";

type Props = { params: Promise<{ locale: string; token: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const locale = await resolveLocale(params);
  const t = await getTranslations("auth");
  const inv = await findInvitation(token);
  const inviter = inv ? await db.query.user.findFirst({ where: eq(schema.user.id, inv.invitedBy), columns: { name: true } }) : null;
  return (
    <PortalPublicShell>
      <Card className="mx-auto max-w-[560px] p-6 sm:p-8">
        {!inv ? (
          <Callout tone="error">{t("inviteInvalid")}</Callout>
        ) : (
          <>
            <h1 className="font-serif text-[30px] leading-tight">{t("inviteTitle")}</h1>
            <p className="mt-2 text-ink-2">{t("inviteBody", { inviter: inviter?.name ?? "", organisation: inv.landlord.name })}</p>
            <div className="mt-6">
              <AcceptInviteForm token={token} locale={locale} email={inv.email} />
            </div>
          </>
        )}
      </Card>
    </PortalPublicShell>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { isOwner, requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { CloseAccountForm, InviteForm, MemberControls, ProfileForm, RevokeButton } from "@/components/portal/account-forms";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { formatDateTimeShort } from "@/lib/format";
import { landlordAccount } from "@/lib/queries/portal";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function AccountPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const t = await getTranslations("portal.account");
  const { landlord, members, invites } = await landlordAccount(me.landlordId);
  const owner = isOwner(me);
  return (
    <PortalShell viewer={me} active="account">
      <h1 className="font-serif text-[32px] leading-tight">{t("title")}</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card className="p-6">
            <h2 className="text-h3">{t("membersTitle")}</h2>
            <p className="mt-1 text-[14px] text-ink-2">{t("membersIntro")}</p>
            <ul className="mt-4 flex flex-col divide-y divide-hairline">
              {members.map((m) => (
                <li key={m.userId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-[650]">{m.name}{m.userId === me.userId ? <span className="ml-1 text-meta font-normal text-muted">({t("you")})</span> : null}</p>
                    <p className="text-meta text-muted">{m.email}</p>
                  </div>
                  {owner ? <MemberControls userId={m.userId} name={m.name} role={m.role} isSelf={m.userId === me.userId} /> : <StatusPill tone={m.role === "owner" ? "info" : "quiet"}>{m.role === "owner" ? t("roleOwner") : t("roleEditor")}</StatusPill>}
                </li>
              ))}
            </ul>
            {owner ? (
              <div className="mt-6 border-t border-hairline pt-5">
                <h3 className="text-h3">{t("inviteTitle")}</h3>
                <div className="mt-3"><InviteForm /></div>
                {invites.length ? (
                  <>
                    <h3 className="mt-6 text-label font-[650] uppercase tracking-wide text-muted">{t("pendingInvites")}</h3>
                    <ul className="mt-2 flex flex-col divide-y divide-hairline">
                      {invites.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-[14px]">
                          <span><span className="font-[600]">{i.email}</span> · {i.role === "owner" ? t("roleOwner") : t("roleEditor")}<span className="block text-meta text-muted">{t("invitedBy", { name: i.inviterName ?? "" })} · {t("expires", { date: formatDateTimeShort(locale, i.expiresAt) })}</span></span>
                          <RevokeButton id={i.id} />
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
          </Card>
          <Card className="p-6">
            <h2 className="text-h3">{t("profileTitle")}</h2>
            <div className="mt-4"><ProfileForm name={me.name} email={me.email} /></div>
          </Card>
        </div>
        <aside>
          <Card className="p-5">
            <h2 className="text-h3">{t("organisation")}</h2>
            <dl className="mt-3 flex flex-col gap-2 text-[14px]">
              <div><dt className="text-meta text-muted">{t("organisation")}</dt><dd className="font-[650]">{landlord.name}</dd></div>
              <div><dt className="text-meta text-muted">{t("orgNumber")}</dt><dd className="tabular">{landlord.orgNumber ?? "—"}</dd></div>
              <div><dt className="text-meta text-muted">{t("website")}</dt><dd>{landlord.website ?? "—"}</dd></div>
            </dl>
          </Card>
          {owner ? (
            <Card className="mt-4 border-error-border p-5">
              <h2 className="text-h3 text-error-text">{t("closeTitle")}</h2>
              <p className="mt-2 text-[14px] text-ink-2">{t("closeIntro")}</p>
              <div className="mt-3">
                <CloseAccountForm organisation={landlord.name} />
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </PortalShell>
  );
}

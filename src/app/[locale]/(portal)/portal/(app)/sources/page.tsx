import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { isOwner, requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { RunNowButton } from "@/components/portal/source-controls";
import { StatusPill, type StatusTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { formatDateTimeShort } from "@/lib/format";
import { landlordSources } from "@/lib/queries/portal";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

export const SOURCE_TONES: Record<string, StatusTone> = { active: "success", degraded: "warning", failed: "error", needs_review: "info", disabled: "quiet", pending: "neutral" };
export const SOURCE_LABEL: Record<string, "statusActive" | "statusDegraded" | "statusFailed" | "statusReview" | "statusDisabled" | "statusPending"> = { active: "statusActive", degraded: "statusDegraded", failed: "statusFailed", needs_review: "statusReview", disabled: "statusDisabled", pending: "statusPending" };

export default async function SourcesPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const t = await getTranslations("portal.source");
  const rows = await landlordSources(me.landlordId);
  const owner = isOwner(me);
  return (
    <PortalShell viewer={me} active="sources">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-[32px] leading-tight">{t("listTitle")}</h1>
        {owner ? <Link href="/portal/sources/new" className={buttonClasses("primary")}>{t("title")}</Link> : null}
      </div>
      {!owner ? <p className="mt-1 text-meta text-muted">{t("ownerOnly")}</p> : null}
      <Card className="mt-6 overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead>
                <tr className="text-left text-meta uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-[650]">{t("urlLabel")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("typeLabelShort")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("colStatus")}</th>
                  <th className="px-4 py-2.5 text-right font-[650]">{t("listings")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("colLastRun")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, listings }) => (
                  <tr key={s.id} className="border-t border-hairline">
                    <td className="px-4 py-3"><Link href={{ pathname: "/portal/sources/[id]", params: { id: s.id } }} className="break-all font-mono text-[13px] font-[600]">{s.url}</Link></td>
                    <td className="px-4 py-3 uppercase text-ink-2">{s.kind}</td>
                    <td className="px-4 py-3"><StatusPill tone={SOURCE_TONES[s.status] ?? "quiet"}>{t(SOURCE_LABEL[s.status] ?? "statusPending")}</StatusPill></td>
                    <td className="px-4 py-3 text-right tabular">{listings}</td>
                    <td className="px-4 py-3 text-ink-2">{s.lastRunAt ? formatDateTimeShort(locale, s.lastRunAt) : t("never")}</td>
                    <td className="px-4 py-3 text-right">{owner && s.status !== "disabled" ? <RunNowButton id={s.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-ink-2">{t("noSources")}</p>
            {owner ? <Link href="/portal/sources/new" className={buttonClasses("primary", "md", "mt-4")}>{t("title")}</Link> : null}
          </div>
        )}
      </Card>
    </PortalShell>
  );
}

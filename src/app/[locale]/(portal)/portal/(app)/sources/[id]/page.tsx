import type { Metadata } from "next";
import { SOURCE_FIELD_KEYS, isCanonicalField } from "@/components/portal/source-field-keys";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { isOwner, requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { EnableToggle, RunNowButton, SourceSettingsForm } from "@/components/portal/source-controls";
import { StatusPill } from "@/components/ui/badge";
import { Card, Callout, icons } from "@/components/ui/misc";
import { formatDateTimeShort } from "@/lib/format";
import { landlordSource } from "@/lib/queries/portal";
import { SOURCE_LABEL, SOURCE_TONES } from "../page";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function SourceDetailPage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const data = await landlordSource(me.landlordId, id);
  if (!data) notFound();
  const { source: s, runs, activeListings } = data;
  const t = await getTranslations("portal.source");
  const owner = isOwner(me);
  const cfg = s.config as { fields?: Record<string, string>; apiKey?: string };
  return (
    <PortalShell viewer={me} active="sources">
      <nav aria-label={(await getTranslations("common"))("navBreadcrumb")} className="text-[13.5px] text-muted"><Link href="/portal/sources" className="text-muted hover:text-ink">{t("backToList")}</Link></nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-all font-mono text-[20px] font-[650]">{s.url}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-3 text-[14px] text-ink-2">
            <StatusPill tone={SOURCE_TONES[s.status] ?? "quiet"}>{t(SOURCE_LABEL[s.status] ?? "statusPending")}</StatusPill>
            <span>{t("listings")}: <span className="tabular">{activeListings}</span></span>
            <span>{t("lastRun")}: {s.lastRunAt ? formatDateTimeShort(locale, s.lastRunAt) : t("never")}</span>
            <span>{t("lastSuccess")}: {s.lastSuccessAt ? formatDateTimeShort(locale, s.lastSuccessAt) : t("never")}</span>
          </p>
        </div>
        {owner ? <div className="flex gap-2">{s.status !== "disabled" ? <RunNowButton id={s.id} size="md" /> : null}<EnableToggle id={s.id} enabled={s.status !== "disabled"} /></div> : null}
      </div>
      {s.lastError ? <div className="mt-4"><Callout tone="warning" icon={icons.warn}>{s.lastError}</Callout></div> : null}
      {s.kind === "html" && s.status === "pending" ? <div className="mt-4"><Callout tone="info" icon={icons.info}>{t("htmlNote")}</Callout></div> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-3 text-h3">{t("runsTitle")}</h2>
          {runs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[14px]">
                <thead>
                  <tr className="text-left text-meta uppercase tracking-wide text-muted">
                    <th className="px-4 py-2 font-[650]">{t("colStarted")}</th>
                    <th className="px-4 py-2 font-[650]">{t("colResult")}</th>
                    <th className="px-4 py-2 text-right font-[650]">{t("colFound")}</th>
                    <th className="px-4 py-2 text-right font-[650]">{t("colNew")}</th>
                    <th className="px-4 py-2 text-right font-[650]">{t("colGone")}</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-hairline">
                      <td className="px-4 py-2 tabular">{formatDateTimeShort(locale, r.startedAt)}</td>
                      <td className="px-4 py-2"><StatusPill tone={r.ok ? "success" : r.ok === false ? "error" : "quiet"}>{r.ok ? t("ok") : r.ok === false ? t("failed") : "…"}</StatusPill>{r.errorDetail ? <span className="ml-2 text-meta text-muted">{r.errorDetail}</span> : null}</td>
                      <td className="px-4 py-2 text-right tabular">{r.listingsFound ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular">{r.listingsNew ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular">{r.listingsGone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="px-5 py-8 text-center text-ink-2">{t("noRuns")}</p>}
        </Card>
        <aside className="flex flex-col gap-4">
          {owner ? (
            <Card className="p-5">
              <h2 className="text-h3">{t("settingsTitle")}</h2>
              <div className="mt-3">
                <SourceSettingsForm id={s.id} interval={s.fetchIntervalMinutes} techContact={s.techContactEmail ?? ""} queueDefault={s.queueDefault ?? ""} hasApiKey={Boolean(cfg.apiKey)} kind={s.kind} />
              </div>
            </Card>
          ) : null}
          {cfg.fields && Object.keys(cfg.fields).length ? (
            <Card className="p-5">
              <h2 className="text-h3">{t("mapTitle")}</h2>
              <dl className="mt-3 flex flex-col gap-1 text-[13.5px]">
                {Object.entries(cfg.fields).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{isCanonicalField(k) ? t(SOURCE_FIELD_KEYS[k]) : k}</dt><dd className="font-mono">{v}</dd></div>
                ))}
              </dl>
            </Card>
          ) : null}
        </aside>
      </div>
    </PortalShell>
  );
}

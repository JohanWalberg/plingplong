import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Kpi, Table, Td, Th } from "@/components/admin/admin-shell";
import { ActionButton } from "@/components/admin/action-buttons";
import { SourceStatusPill } from "@/components/admin/source-status";
import { attentionItems, listSources, overviewKpis } from "@/lib/queries/admin";
import { runAllSyncs, runSourceSync } from "@/actions/admin";
import { formatDateTime, formatTime } from "@/lib/format";
import { Card } from "@/components/ui/misc";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminOverview({ params }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const t = await getTranslations("admin.overview");
  const ts = await getTranslations("admin.sources");
  const [kpis, sources, attention] = await Promise.all([overviewKpis(), listSources(), attentionItems()]);
  const now = new Date();

  return (
    <AdminShell viewer={viewer} active="overview" title={t("title")} actions={<ActionButton action={runAllSyncs.bind(null, locale)} variant="dark" successMessage={t("runAllQueued", { count: sources.length })}>{t("runAll")}</ActionButton>}>
      <p className="text-meta text-muted">{t("updated", { date: formatDateTime(locale, now) })}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("kpiActive")} value={kpis.active} delta={kpis.addedToday ? `+${kpis.addedToday}` : undefined} tone="good" />
        <Kpi label={t("kpiSources")} value={kpis.sources.total} />
        <Kpi label={t("kpiHealthy")} value={kpis.sources.healthy} />
        <Kpi label={t("kpiDegraded")} value={kpis.sources.degraded} tone="warn" />
        <Kpi label={t("kpiFailed")} value={kpis.sources.failed} tone="bad" />
        <Kpi label={t("kpiAddedToday")} value={kpis.addedToday} />
        <Kpi label={t("kpiErrors")} value={kpis.errors24h} tone={kpis.errors24h ? "bad" : "neutral"} />
        <Kpi label={t("kpiPending")} value={kpis.pending} tone={kpis.pending ? "warn" : "neutral"} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px] [&>*]:min-w-0">
        <section aria-labelledby="sources-title">
          <div className="flex items-center justify-between">
            <h2 id="sources-title" className="text-h3">
              {t("sourcesTitle")}
            </h2>
            <Link href="/admin/sources" className="text-[13.5px] font-[650]">
              {ts("title")} →
            </Link>
          </div>
          <div className="mt-2">
            <Table minWidth={860}>
              <thead>
                <tr className="border-b border-line">
                  <Th>{ts("colSource")}</Th>
                  <Th>{ts("colLandlord")}</Th>
                  <Th>{ts("colType")}</Th>
                  <Th>{ts("colStatus")}</Th>
                  <Th right>{ts("colListings")}</Th>
                  <Th>{ts("colLastSync")}</Th>
                  <Th right>{ts("colErrors")}</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {sources.slice(0, 10).map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <Td>
                      <Link href={{ pathname: "/admin/sources/[id]", params: { id: s.id } }} className="font-mono text-[13px]">
                        {s.url?.replace(/^https?:\/\//, "").slice(0, 40)}
                      </Link>
                    </Td>
                    <Td>{s.landlordName}</Td>
                    <Td>{ts(s.kind === "feed" ? "typeFeed" : s.kind === "api" ? "typeApi" : "typeHtml")}</Td>
                    <Td>
                      <SourceStatusPill status={s.status} />
                    </Td>
                    <Td right>{s.listings}</Td>
                    <Td>{s.lastRunAt ? formatTime(locale, s.lastRunAt) : ts("never")}</Td>
                    <Td right className={s.errors24h ? "font-[700] text-error-text" : "text-muted"}>
                      {s.errors24h || "—"}
                    </Td>
                    <Td right>
                      <ActionButton action={runSourceSync.bind(null, locale, s.id)}>{ts("runSync")}</ActionButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="attention-title">
          <h2 id="attention-title" className="text-h3">
            {t("attentionTitle")}
          </h2>
          <Card className="mt-2 divide-y divide-hairline">
            {!attention.failed.length && !attention.anomalies.length && !attention.dups.length && !attention.missingRent.length && !kpis.pending ? <p className="p-4 text-[14px] text-muted">{t("noAttention")}</p> : null}
            {attention.failed.map((f) => (
              <Alert key={f.id} tone={f.status === "failed" ? "bad" : "warn"} title={f.name} href={{ pathname: "/admin/sources/[id]", params: { id: f.id } }} when={f.at ? formatTime(locale, f.at) : ""}>
                {t("alertFailed", { count: f.failures, detail: f.error ?? "" })}
              </Alert>
            ))}
            {attention.anomalies.map((a) => (
              <Alert key={a.sourceId} tone="warn" title={a.name} href={{ pathname: "/admin/sources/[id]", params: { id: a.sourceId } }} when={formatTime(locale, a.at)}>
                {t("alertDrop", { from: a.prev ?? "?", to: a.found ?? 0 })}
              </Alert>
            ))}
            {attention.dups.map((d) => (
              <Alert key={d.name} tone="info" title={d.name} href="/admin/duplicates" when={d.at ? formatTime(locale, new Date(d.at)) : ""}>
                {t("alertDuplicates", { count: d.count })}
              </Alert>
            ))}
            {attention.missingRent.map((m) => (
              <Alert key={m.id} tone="info" title={m.name} href={{ pathname: "/admin/landlords/[id]", params: { id: m.id } }} when="">
                {t("alertMissingRent", { count: m.count })}
              </Alert>
            ))}
            {kpis.pending ? (
              <Alert tone="info" title={(await getTranslations("admin.nav"))("queue")} href="/admin/applications" when="">
                {t("alertPendingApplications", { count: kpis.pending })}
              </Alert>
            ) : null}
          </Card>
        </section>
      </div>
    </AdminShell>
  );
}

function Alert({ tone, title, children, href, when }: { tone: "bad" | "warn" | "info"; title: string; children: React.ReactNode; href: Parameters<typeof Link>[0]["href"]; when: string }) {
  const dot = tone === "bad" ? "bg-error" : tone === "warn" ? "bg-warning" : "bg-info";
  const glyph = tone === "bad" ? "■" : tone === "warn" ? "◐" : "?";
  return (
    <div className="flex gap-3 p-4">
      <span aria-hidden="true" className={`mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] text-white ${dot}`}>
        {glyph}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={href} className="font-[650] text-ink hover:text-primary">
            {title}
          </Link>
          <span className="shrink-0 text-meta text-muted">{when}</span>
        </div>
        <p className="mt-0.5 text-[13.5px] text-ink-2">{children}</p>
      </div>
    </div>
  );
}

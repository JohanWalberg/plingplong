import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { BarChart, SERIES_COLORS } from "@/components/portal/bar-chart";
import { StatusPill } from "@/components/ui/badge";
import { Card } from "@/components/ui/misc";
import { formatNumber } from "@/lib/format";
import { landlordListingDailyViews, landlordListingTotals, landlordMetricsSeries } from "@/lib/queries/portal";
import { Sparkline } from "@/components/portal/sparkline";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function StatisticsPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const [t, td, tp, series, rows, daily] = await Promise.all([getTranslations("portal.stats"), getTranslations("portal.dash"), getTranslations("portal.perf"), landlordMetricsSeries(me.landlordId, 30), landlordListingTotals(me.landlordId), landlordListingDailyViews(me.landlordId, 14)]);
  const views = series.reduce((a, b) => a + b.views, 0);
  const clicks = series.reduce((a, b) => a + b.clicks, 0);
  const saves = series.reduce((a, b) => a + b.saves, 0);
  const label = (s: string) => td(({ active: "statusLive", draft: "statusDraft", expired: "statusExpired", unpublished: "statusUnpublished", removed: "statusRemoved" } as const)[s as "active"] ?? "statusDraft");
  return (
    <PortalShell viewer={me} active="statistics">
      <h1 className="font-serif text-[32px] leading-tight">{t("title")}</h1>
      <p className="mt-1 max-w-[64ch] text-ink-2">{t("intro")}</p>
      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4"><dt className="text-meta text-muted">{t("totalViews")}</dt><dd className="mt-1 text-[26px] font-[700] tabular">{formatNumber(locale, views)}</dd></Card>
        <Card className="p-4"><dt className="text-meta text-muted">{t("totalClicks")}</dt><dd className="mt-1 text-[26px] font-[700] tabular">{formatNumber(locale, clicks)}</dd></Card>
        <Card className="p-4"><dt className="text-meta text-muted">{t("totalSaves")}</dt><dd className="mt-1 text-[26px] font-[700] tabular">{formatNumber(locale, saves)}</dd></Card>
      </dl>
      <Card className="mt-4 p-6">
        <BarChart
          rows={series.map((s) => ({ day: s.day, values: { views: s.views, clicks: s.clicks, saves: s.saves } }))}
          series={[
            { key: "views", label: t("views"), color: SERIES_COLORS.views },
            { key: "clicks", label: t("clicks"), color: SERIES_COLORS.clicks },
            { key: "saves", label: t("saves"), color: SERIES_COLORS.saves },
          ]}
          locale={locale}
          label={t("chartLabel")}
          tableCaption={t("chartLabel")}
          dayLabel={tp("colDay")}
        />
        <p className="mt-2 text-meta text-muted">{tp("metricNote")}</p>
      </Card>
      <Card className="mt-6 overflow-hidden">
        <h2 className="border-b border-line px-5 py-3 text-h3">{t("perListing")}</h2>
        {rows.length ? (
          <table className="w-full text-[14px]">
            <thead><tr className="text-left text-meta uppercase tracking-wide text-muted"><th className="px-4 py-2 font-[650]">{t("colListing")}</th><th className="px-4 py-2 font-[650]">{t("colStatus")}</th><th className="px-4 py-2 font-[650]">{t("colTrend")}</th><th className="px-4 py-2 text-right font-[650]">{t("colViews")}</th><th className="px-4 py-2 text-right font-[650]">{t("colClicks")}</th><th className="px-4 py-2 text-right font-[650]">{t("colSaves")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-hairline">
                  <td className="px-4 py-2.5"><Link href={{ pathname: "/portal/homes/[id]", params: { id: r.id } }} className="font-[600]">{r.address}</Link></td>
                  <td className="px-4 py-2.5"><StatusPill tone={r.status === "active" ? "success" : "quiet"}>{label(r.status)}</StatusPill></td>
                  <td className="px-4 py-2.5"><Sparkline values={daily.series(r.id)} label={t("trendLabel", { address: r.address })} color={SERIES_COLORS.views} /></td>
                  <td className="px-4 py-2.5 text-right tabular">{r.views}</td>
                  <td className="px-4 py-2.5 text-right tabular">{r.clicks}</td>
                  <td className="px-4 py-2.5 text-right tabular">{r.saves}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="px-5 py-8 text-center text-ink-2">{t("empty")}</p>}
      </Card>
    </PortalShell>
  );
}

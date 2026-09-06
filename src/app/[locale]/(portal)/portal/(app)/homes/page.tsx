import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { StatusPill, type StatusTone } from "@/components/ui/badge";
import { Card, Callout, icons } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { formatDateShort, formatNumber, formatPercent, formatRent, formatRooms, formatSize } from "@/lib/format";
import { landlordKpis, landlordListings, landlordStatusCounts, PORTAL_STATUSES, type PortalStatus } from "@/lib/queries/portal";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false } };

const TONES: Record<PortalStatus, StatusTone> = { active: "success", draft: "quiet", expired: "neutral", unpublished: "neutral", removed: "warning" };
const LABELS: Record<PortalStatus, "statusLive" | "statusDraft" | "statusExpired" | "statusUnpublished" | "statusRemoved"> = { active: "statusLive", draft: "statusDraft", expired: "statusExpired", unpublished: "statusUnpublished", removed: "statusRemoved" };
const TABS: Record<PortalStatus, "tabPublished" | "tabDraft" | "tabExpired" | "tabUnpublished" | "tabRemoved"> = { active: "tabPublished", draft: "tabDraft", expired: "tabExpired", unpublished: "tabUnpublished", removed: "tabRemoved" };

export default async function PortalHomesPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const sp = await searchParams;
  const status = (PORTAL_STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as PortalStatus) : "active";
  const q = sp.q?.trim() || undefined;
  const [t, tl, kpis, counts, rows] = await Promise.all([getTranslations("portal.dash"), getTranslations("listing"), landlordKpis(me.landlordId), landlordStatusCounts(me.landlordId), landlordListings(me.landlordId, status, q)]);
  const delta = (cur: number, prev: number) => (prev > 0 ? formatPercent(locale, (cur - prev) / prev, 0) : null);
  const kpiRows = [
    { label: t("kpiPublished"), value: formatNumber(locale, kpis.published) },
    { label: t("kpiViews"), value: formatNumber(locale, kpis.views), delta: delta(kpis.views, kpis.prevViews) },
    { label: t("kpiClicks"), value: formatNumber(locale, kpis.clicks), delta: delta(kpis.clicks, kpis.prevClicks) },
    { label: t("kpiClosing"), value: formatNumber(locale, kpis.closing), warn: kpis.closing > 0 },
  ];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <PortalShell viewer={me} active="homes">
      {sp.denied ? <div className="mb-4"><Callout tone="warning" icon={icons.warn}>{(await getTranslations("auth"))("noAccess")}</Callout></div> : null}
      <h1 className="sr-only">{(await getTranslations("portal.nav"))("homes")}</h1>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiRows.map((k) => (
          <Card key={k.label} className="p-4">
            <dt className="text-meta text-muted">{k.label}</dt>
            <dd className={`mt-1 flex items-baseline gap-2 text-[26px] font-[700] leading-none tabular ${k.warn ? "text-warning-text" : ""}`}>
              {k.value}
              {k.delta ? <span className="text-[13px] font-[650] text-success">{k.delta.startsWith("-") ? k.delta : `+${k.delta}`}</span> : null}
            </dd>
          </Card>
        ))}
      </dl>
      <p className="mt-1 text-meta text-muted">{t("deltaVsPrevious")}</p>

      <Card className="mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <nav className="flex flex-wrap gap-1" aria-label={t("colStatus")}>
            {PORTAL_STATUSES.map((s) => (
              <Link key={s} href={{ pathname: "/portal/homes", query: { ...(s !== "active" ? { status: s } : {}), ...(q ? { q } : {}) } }} aria-current={s === status ? "page" : undefined} className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-[13.5px] font-[650] hover:no-underline ${s === status ? "bg-ink text-white hover:text-white" : "text-ink-2 hover:bg-bg"}`}>
                {t(TABS[s])}
                <span className={`tabular ${s === status ? "text-dark-muted" : "text-muted"}`}>{counts[s] ?? 0}</span>
              </Link>
            ))}
          </nav>
          <form method="get" className="flex items-center gap-2">
            {status !== "active" ? <input type="hidden" name="status" value={status} /> : null}
            <label className="sr-only" htmlFor="q">{t("searchPlaceholder")}</label>
            <input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder={t("searchPlaceholder")} className="min-h-10 w-56 rounded-md border border-line-strong bg-surface px-3 text-[14px]" />
            <button type="submit" className={buttonClasses("secondary", "sm")}>{(await getTranslations("common"))("search")}</button>
          </form>
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-[14px]">
              <thead>
                <tr className="text-left text-meta uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 font-[650]">{t("colAddress")}</th>
                  <th className="px-4 py-2.5 text-right font-[650]">{t("colRent")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("colRoomsSize")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("colStatus")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("colDeadline")}</th>
                  <th className="px-4 py-2.5 text-right font-[650]">{t("colViews")}</th>
                  <th className="px-4 py-2.5 text-right font-[650]">{t("colClicks")}</th>
                  <th className="px-4 py-2.5 font-[650]">{t("colSource")}</th>
                  <th className="px-4 py-2.5"><span className="sr-only">{t("manage")}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-hairline">
                    <td className="px-4 py-3">
                      <Link href={{ pathname: "/portal/homes/[id]", params: { id: r.id } }} className="font-[650] text-ink">{r.address}</Link>
                      {r.areaName ? <span className="block text-meta text-muted">{r.areaName}</span> : null}
                    </td>
                    <td className="px-4 py-3 text-right tabular">{r.rentMonthly !== null ? formatRent(locale, r.rentMonthly) : tl("rentUnknown")}</td>
                    <td className="px-4 py-3 text-ink-2">{r.rooms !== null ? formatRooms(locale, r.rooms) : tl("roomsUnknown")} · {r.sizeSqm !== null ? formatSize(locale, r.sizeSqm) : tl("sizeUnknown")}</td>
                    <td className="px-4 py-3"><StatusPill tone={TONES[r.status as PortalStatus] ?? "quiet"}>{t(LABELS[r.status as PortalStatus] ?? "statusDraft")}</StatusPill></td>
                    <td className="px-4 py-3 text-ink-2">{r.applicationDeadline ? formatDateShort(locale, r.applicationDeadline) : "—"}</td>
                    <td className="px-4 py-3 text-right tabular">{r.views || "—"}</td>
                    <td className="px-4 py-3 text-right tabular">{r.clicks || "—"}</td>
                    <td className="px-4 py-3 text-meta text-muted">{r.publishedDirectly ? t("sourceDirect") : (r.sourceUrl ? new URL(r.sourceUrl).host.replace(/^www\./, "") : "—")}</td>
                    <td className="px-4 py-3 text-right"><Link href={{ pathname: "/portal/homes/[id]", params: { id: r.id } }} className={buttonClasses("secondary", "sm")}>{t("manage")}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <h2 className="text-h3">{total === 0 ? t("emptyTitle") : t("emptyFiltered")}</h2>
            {total === 0 ? <p className="mx-auto mt-2 max-w-[44ch] text-ink-2">{t("emptyBody")}</p> : null}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href="/portal/homes/new" className={buttonClasses("primary")}>{(await getTranslations("portal.nav"))("newHome")}</Link>
              <Link href="/portal/sources/new" className={buttonClasses("secondary")}>{(await getTranslations("portal.source"))("title")}</Link>
            </div>
          </div>
        )}
        <p className="border-t border-hairline px-4 py-3 text-meta text-muted">{t("sourceNote")}</p>
      </Card>
    </PortalShell>
  );
}

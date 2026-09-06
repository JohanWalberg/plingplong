import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { isOwner, requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { ListingActions } from "@/components/portal/listing-actions";
import { BarChart } from "@/components/portal/bar-chart";
import { Freshness } from "@/components/listing/freshness";
import { StatusPill, type StatusTone } from "@/components/ui/badge";
import { Card, Callout, Kicker, icons } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { absoluteUrl } from "@/lib/seo";
import { daysUntil, formatDateLong, formatDateShort, formatDateTimeShort, formatNumber, formatPercent, formatRent, formatRooms, formatSize } from "@/lib/format";
import { landlordListing, listingMetrics } from "@/lib/queries/portal";
import { municipalityName } from "@/lib/queries/places";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false } };

const TONES: Record<string, StatusTone> = { active: "success", draft: "quiet", expired: "neutral", unpublished: "neutral", removed: "warning", unknown: "quiet" };

export default async function ManageHomePage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const l = await landlordListing(me.landlordId, id);
  if (!l) notFound();
  const [t, td, tl, series] = await Promise.all([getTranslations("portal.perf"), getTranslations("portal.dash"), getTranslations("listing"), listingMetrics(l.id, 30)]);
  const views = series.reduce((a, b) => a + b.views, 0);
  const clicks = series.reduce((a, b) => a + b.clicks, 0);
  const saves = series.reduce((a, b) => a + b.saves, 0);
  const daysLeft = l.applicationDeadline ? daysUntil(l.applicationDeadline) : null;
  const statusKey = ({ active: "statusLive", draft: "statusDraft", expired: "statusExpired", unpublished: "statusUnpublished", removed: "statusRemoved" } as const)[l.status as "active" | "draft" | "expired" | "unpublished" | "removed"] ?? "statusDraft";
  const canPublish = isOwner(me);
  const fetched = !l.publishedDirectly;
  const sourceUrl = l.sources[0]?.sourceUrl ?? l.sources[0]?.source.url ?? null;
  const fieldName: Record<string, string> = { rent_monthly: t("fieldRent"), rooms: t("fieldRooms"), size_sqm: t("fieldSize"), application_deadline: t("fieldDeadline"), move_in_date: t("fieldMoveIn"), address: t("fieldAddress"), queue_requirement: t("fieldMoveIn"), status: t("fieldStatus") };
  const fmt = (field: string, v: string | null) => {
    if (v === null) return "—";
    if (field === "rent_monthly") return formatRent(locale, Number(v));
    if (field === "size_sqm") return formatSize(locale, Number(v));
    if (field === "rooms") return formatRooms(locale, Number(v));
    if (field === "application_deadline" || field === "move_in_date") return formatDateLong(locale, v);
    if (field === "status") return td(({ active: "statusLive", draft: "statusDraft", expired: "statusExpired", unpublished: "statusUnpublished", removed: "statusRemoved" } as const)[v as "active"] ?? "statusDraft");
    return v;
  };

  type Ev = { at: Date; title: string; body: string; future: boolean };
  const events: Ev[] = [];
  for (const r of l.revisions) {
    if (r.field === "status") {
      const map: Record<string, [string, string]> = { active: [r.oldValue ? t("eventRepublished") : t("eventPublished"), t("eventPublishedBody")], draft: [t("eventDraft"), ""], unpublished: [t("eventUnpublished"), t("eventUnpublishedBody")], expired: [t("eventAutoUnpublish"), t("eventAutoUnpublishBody")], removed: [t("eventRemovedAtSource"), t("eventRemovedAtSourceBody")] };
      const [title, body] = map[r.newValue ?? ""] ?? [r.newValue ?? "", ""];
      events.push({ at: r.changedAt, title: r.newValue === "active" && !r.oldValue ? t("eventPublished") : title, body, future: false });
    } else {
      events.push({ at: r.changedAt, title: t("eventChanged", { field: fieldName[r.field] ?? r.field }), body: t("eventChangedBody", { old: fmt(r.field, r.oldValue), new: fmt(r.field, r.newValue) }), future: false });
    }
  }
  if (fetched && l.sources[0]) events.push({ at: l.firstSeenAt, title: t("eventFirstSeen"), body: t("eventFirstSeenBody", { source: l.sources[0].source.url ?? "" }), future: false });
  if (l.reviewedAt) events.push({ at: l.reviewedAt, title: t("eventReviewed"), body: t("eventReviewedBody"), future: false });
  if (l.status === "active" && l.applicationDeadline) {
    const dl = new Date(`${l.applicationDeadline}T12:00:00+02:00`);
    events.push({ at: dl, title: t("eventDeadline"), body: t("eventDeadlineBody", { date: formatDateLong(locale, l.applicationDeadline) }), future: dl > new Date() });
    if (l.publishedDirectly) events.push({ at: new Date(dl.getTime() + 7 * 86400000), title: t("eventAutoUnpublish"), body: t("eventAutoUnpublishBody"), future: true });
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  const stats = [
    { label: t("views"), value: formatNumber(locale, views), sub: t("viewsSub") },
    { label: t("clicks"), value: formatNumber(locale, clicks), sub: views ? t("clicksSub", { ratio: formatPercent(locale, clicks / views) }) : "" },
    { label: t("saves"), value: formatNumber(locale, saves), sub: t("savesSub") },
    { label: t("daysLeft"), value: daysLeft === null ? t("rolling") : daysLeft < 0 ? "0" : formatNumber(locale, daysLeft), sub: l.applicationDeadline ? t("daysLeftSub", { date: formatDateShort(locale, l.applicationDeadline) }) : "" },
  ];

  return (
    <PortalShell viewer={me} active="homes">
      <nav aria-label="" className="text-[13.5px] text-muted">
        <Link href="/portal/homes" className="text-muted hover:text-ink">{t("crumb")}</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-ink">{l.address}</span>
      </nav>
      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-serif text-[30px] leading-tight">{l.address}</h1>
                <p className="mt-1 text-ink-2">{l.areaName ? `${l.areaName}, ` : ""}{municipalityName(l.municipality, locale)} · {l.rooms !== null ? formatRooms(locale, l.rooms) : tl("roomsUnknown")} · {l.sizeSqm !== null ? formatSize(locale, l.sizeSqm) : tl("sizeUnknown")}</p>
              </div>
              <StatusPill tone={TONES[l.status] ?? "quiet"}>{td(statusKey)}</StatusPill>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <dt className="text-meta text-muted">{s.label}</dt>
                  <dd className="mt-0.5 text-[24px] font-[700] leading-none tabular">{s.value}</dd>
                  {s.sub ? <dd className="mt-1 text-meta text-muted">{s.sub}</dd> : null}
                </div>
              ))}
            </dl>
            <p className="mt-4 text-meta text-muted">{t("metricNote")}</p>
          </Card>

          {fetched ? (
            <Callout tone="info" icon={icons.info}>
              {t("fetchedNote", { source: sourceUrl ? new URL(sourceUrl).host.replace(/^www\./, "") : "" })}
              {sourceUrl ? <> <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="font-[650]">{tl("openListing")}</a></> : null}
            </Callout>
          ) : null}

          <Card className="p-6">
            <h2 className="text-h3">{t("viewsTitle")}</h2>
            <div className="mt-3">
              <BarChart series={series.slice(-14).map((s) => ({ day: s.day, value: s.views }))} locale={locale} label={t("chartLabel")} tableCaption={t("chartTable")} valueLabel={t("colViews")} dayLabel={t("colDay")} />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-h3">{t("timelineTitle")}</h2>
            <ol className="mt-4 flex flex-col">
              {events.map((e, i) => (
                <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                  <span aria-hidden="true" className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${e.future ? "border-2 border-line-strong bg-surface" : "bg-primary"}`} />
                  {i < events.length - 1 ? <span aria-hidden="true" className="absolute left-[5px] top-5 h-full w-px bg-hairline" /> : null}
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-[650]">{e.title}{e.future ? <span className="ml-2 text-meta font-normal text-muted">({t("scheduled")})</span> : null}</p>
                    {e.body ? <p className="text-[13.5px] text-ink-2">{e.body}</p> : null}
                    <p className="text-meta text-muted tabular">{formatDateTimeShort(locale, e.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-5">
            <h2 className="text-h3">{t("actionsTitle")}</h2>
            <div className="mt-3 flex flex-col gap-2">
              {!fetched && (canPublish || l.status === "draft") ? <Link href={{ pathname: "/portal/homes/[id]/edit", params: { id: l.id } }} className={buttonClasses("secondary", "md")}>{t("edit")}</Link> : null}
              {!fetched && !canPublish && l.status !== "draft" ? <p className="text-meta text-muted">{t("editorReadOnly")}</p> : null}
              {!fetched ? <ListingActions id={l.id} status={l.status} deadline={l.applicationDeadline} canPublish={canPublish} /> : null}
              {!fetched && canPublish && l.status === "draft" ? <Link href={{ pathname: "/portal/homes/[id]/edit", params: { id: l.id } }} className={buttonClasses("primary", "md")}>{t("publishDraft")}</Link> : null}
            </div>
          </Card>
          {l.status !== "draft" ? (
            <Card className="p-5">
              <Kicker>{t("publicTitle")}</Kicker>
              <a href={absoluteUrl(locale, { pathname: "/home/[slug]", params: { slug: l.slug } })} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-[13.5px] font-[600]">
                {absoluteUrl(locale, { pathname: "/home/[slug]", params: { slug: l.slug } }).replace(/^https?:\/\//, "")}
              </a>
              <div className="mt-2"><Freshness lastCheckedAt={l.lastCheckedAt} prefix="last" /></div>
            </Card>
          ) : null}
        </aside>
      </div>
    </PortalShell>
  );
}

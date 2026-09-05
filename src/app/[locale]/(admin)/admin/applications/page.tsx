import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell } from "@/components/admin/admin-shell";
import { ActionButton, ConfirmActionButton } from "@/components/admin/action-buttons";
import { applicationCounts, listApplications } from "@/lib/queries/admin";
import { approveApplication, rejectApplication, reopenApplication, requestMoreInfo } from "@/actions/admin";
import { formatDateTimeShort } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, Kicker, icons } from "@/components/ui/misc";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

function RelativeAge({ date, locale }: { date: Date; locale: "sv" | "en" }) {
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(locale === "sv" ? "sv-SE" : "en-GB", { numeric: "auto" });
  const text = minutes < 60 ? rtf.format(-minutes, "minute") : minutes < 1440 ? rtf.format(-Math.round(minutes / 60), "hour") : rtf.format(-Math.round(minutes / 1440), "day");
  return <time dateTime={date.toISOString()}>{text}</time>;
}

export default async function ApplicationsPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const sp = await searchParams;
  const tab = (sp.tab === "needs_info" || sp.tab === "decided" ? sp.tab : "pending") as "pending" | "needs_info" | "decided";
  const t = await getTranslations("admin.queue");
  const [counts, apps] = await Promise.all([applicationCounts(), listApplications(tab)]);
  const selected = apps.find((a) => a.id === sp.id) ?? apps[0] ?? null;
  const lead = viewer.role === "lead";
  const actorIds = [...new Set(apps.flatMap((a) => a.events.map((e) => e.actorId)).filter(Boolean))] as string[];
  const actors = actorIds.length ? await db.query.user.findMany({ where: inArray(schema.user.id, actorIds), columns: { id: true, name: true } }) : [];
  const actorName = (id: string | null) => actors.find((a) => a.id === id)?.name ?? "";

  const checkLabel = (c: { key: string; status: string; detail?: Record<string, unknown> }) => {
    switch (c.key) {
      case "org_format":
        return c.status === "fail" ? t("checkOrgFail") : t("checkOrg");
      case "org_registry":
        return t("checkOrgRegistry");
      case "email_domain":
        return c.status === "na" ? t("checkDomainNa") : c.status === "fail" ? t("checkDomainFail") : t("checkDomain");
      case "feed":
        return c.status === "na" ? t("checkFeedNa") : c.status === "fail" ? t("checkFeedFail", { error: String(c.detail?.error ?? "") }) : t("checkFeed", { count: Number(c.detail?.count ?? 0) });
      case "feed_queue":
        return t("checkQueueMissing");
      default:
        return c.key;
    }
  };

  return (
    <AdminShell viewer={viewer} active="queue" title={t("title")}>
      <p className="text-[14px] text-ink-2">{t("sub", { count: counts.pending })}</p>
      <div className="mt-4 grid gap-6 xl:grid-cols-[1fr_440px]">
        <section>
          <div role="tablist" className="flex gap-1">
            {(["pending", "needs_info", "decided"] as const).map((k) => (
              <Link
                key={k}
                role="tab"
                aria-selected={tab === k}
                href={{ pathname: "/admin/applications", query: { tab: k } }}
                className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-[13.5px] font-[650] hover:no-underline ${tab === k ? "bg-ink text-white hover:text-white" : "text-ink-2 hover:bg-surface"}`}
              >
                {t(k === "pending" ? "tabPending" : k === "needs_info" ? "tabNeedsInfo" : "tabDecided")}
                <span className={`rounded-full px-1.5 text-[11px] ${tab === k ? "bg-white/20" : "bg-surface-muted"}`}>{counts[k]}</span>
              </Link>
            ))}
          </div>
          <Card className="mt-3 divide-y divide-hairline">
            {apps.length ? (
              apps.map((a) => (
                <Link
                  key={a.id}
                  href={{ pathname: "/admin/applications", query: { tab, id: a.id } }}
                  aria-current={selected?.id === a.id ? "true" : undefined}
                  className={`flex items-start gap-3 px-4 py-3 text-ink hover:bg-bg hover:no-underline ${selected?.id === a.id ? "border-l-[3px] border-primary bg-[#fdf9f7]" : "border-l-[3px] border-transparent"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-[650]">{a.companyName}</span>
                    <span className="block text-meta text-muted">
                      {a.orgNumber} · {a.website ?? t("noWebsite")}
                    </span>
                  </span>
                  <Badge tone={a.publishingRoute === "source" ? "info" : "quiet"}>{a.publishingRoute === "source" ? t("routeSource") : t("routeManual")}</Badge>
                  <span className="w-20 shrink-0 text-right text-meta text-muted">
                    <RelativeAge date={a.createdAt} locale={locale} />
                  </span>
                </Link>
              ))
            ) : (
              <p className="p-4 text-[14px] text-muted">{t("empty")}</p>
            )}
          </Card>
        </section>

        <aside className="xl:sticky xl:top-4 xl:self-start">
          {selected ? (
            <Card className="p-5">
              <Kicker>{t("detailLabel")}</Kicker>
              <h2 className="mt-1 text-h3">{selected.companyName}</h2>
              <dl className="mt-4 flex flex-col divide-y divide-hairline text-[14px]">
                {(
                  [
                    [t("orgNumber"), selected.orgNumber],
                    [t("companyName"), selected.companyName],
                    [t("contact"), selected.contactName],
                    [t("email"), selected.contactEmail],
                    [t("phone"), selected.contactPhone ?? "—"],
                    [t("route"), selected.publishingRoute === "source" ? t("routeSource") : t("routeManual")],
                    [t("sourceUrl"), selected.sourceUrl ?? "—"],
                    [t("submitted"), formatDateTimeShort(locale, selected.createdAt)],
                  ] as Array<[string, string]>
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="break-all text-right font-[600]">{v}</dd>
                  </div>
                ))}
              </dl>

              <h3 className="mt-5 text-label font-[650] uppercase tracking-wide text-muted">{t("checksTitle")}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {selected.automatedChecks.map((c) => (
                  <li key={c.key} className="flex items-start gap-2 text-[13.5px]">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-[800] text-white ${c.status === "done" ? "bg-success" : c.status === "warn" ? "bg-warning" : c.status === "fail" ? "bg-error" : "bg-faint"}`}
                    >
                      {c.status === "done" ? "✓" : c.status === "fail" ? "✕" : c.status === "warn" ? "!" : "–"}
                    </span>
                    <span>{checkLabel(c)}</span>
                  </li>
                ))}
              </ul>

              {selected.events.length ? (
                <>
                  <h3 className="mt-5 text-label font-[650] uppercase tracking-wide text-muted">{t("historyTitle")}</h3>
                  <ol className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
                    {selected.events.map((e) => (
                      <li key={e.id}>
                        <span className="text-muted">{formatDateTimeShort(locale, e.createdAt)}</span> ·{" "}
                        {e.kind === "needs_info" ? t("historyRequested", { message: e.message ?? "" }) : e.kind === "rejected" ? t("historyRejected", { reason: e.message ?? "" }) : e.kind === "approved" ? t("historyApproved") : e.kind}
                        {e.actorId ? ` (${actorName(e.actorId)})` : ""}
                      </li>
                    ))}
                  </ol>
                </>
              ) : null}

              {selected.status === "approved" || selected.status === "rejected" ? (
                <p className="mt-5 text-[13.5px] text-muted">
                  {selected.status === "approved" ? t("statusApproved") : t("statusRejected")}
                  {selected.reviewedAt ? ` · ${t("decided", { name: actorName(selected.reviewedBy), date: formatDateTimeShort(locale, selected.reviewedAt) })}` : ""}
                </p>
              ) : (
                <div className="mt-5 flex flex-col gap-2">
                  {!lead ? <p className="text-meta text-muted">{t("leadOnly")}</p> : null}
                  <ConfirmActionButton action={approveApplication.bind(null, locale, selected.id)} variant="primary" size="md" title={t("approve")} body={t("approveNote")} confirmLabel={t("approve")} disabled={!lead} successMessage={t("statusApproved")}>
                    {t("approve")}
                  </ConfirmActionButton>
                  <ConfirmActionButton
                    actionWithText={requestMoreInfo.bind(null, locale, selected.id)}
                    variant="secondary"
                    size="md"
                    title={t("askMoreTitle")}
                    body={t("askMoreBody", { email: selected.contactEmail })}
                    confirmLabel={t("send")}
                    textareaLabel={t("message")}
                    textareaRequired
                    disabled={!lead}
                  >
                    {t("askMore")}
                  </ConfirmActionButton>
                  <ConfirmActionButton
                    actionWithText={rejectApplication.bind(null, locale, selected.id)}
                    variant="danger"
                    size="md"
                    title={t("rejectTitle")}
                    body={t("rejectBody", { email: selected.contactEmail })}
                    confirmLabel={t("reject")}
                    textareaLabel={t("reason")}
                    textareaRequired
                    disabled={!lead}
                  >
                    {t("reject")}
                  </ConfirmActionButton>
                  {selected.status === "needs_info" ? (
                    <ActionButton action={reopenApplication.bind(null, locale, selected.id)} variant="tertiary" size="md" disabled={!lead}>
                      {t("backToPending")}
                    </ActionButton>
                  ) : null}
                  <p className="text-meta text-muted">{t("approveNote")}</p>
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-5 text-[14px] text-muted">
              <span className="mr-2 inline-block align-middle">{icons.info}</span>
              {t("selectHint")}
            </Card>
          )}
        </aside>
      </div>
    </AdminShell>
  );
}

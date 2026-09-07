import type { Metadata } from "next";
import { ListingStatusPill } from "@/components/admin/listing-status";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { ActionButton, ConfirmActionButton } from "@/components/admin/action-buttons";
import { SourceStatusPill } from "@/components/admin/source-status";
import { SourceSettingsForm } from "@/components/admin/source-settings-form";
import { getSource, sourceListings } from "@/lib/queries/admin";
import { markSourceReviewed, runSourceSync, setSourceStatus } from "@/actions/admin";
import { formatDateTime, formatDateTimeShort } from "@/lib/format";
import { Card, Callout, icons } from "@/components/ui/misc";
import { StatusPill } from "@/components/ui/badge";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminSourcePage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const src = await getSource(id);
  if (!src) notFound();
  const t = await getTranslations("admin.sources");
  const tp = await getTranslations("portal.source");
  const listings = await sourceListings(id);
  const lead = viewer.role === "lead";
  const interval = src.fetchIntervalMinutes >= 1440 ? t("daily") : src.fetchIntervalMinutes % 60 === 0 ? t("everyHours", { count: src.fetchIntervalMinutes / 60 }) : t("everyMinutes", { count: src.fetchIntervalMinutes });

  return (
    <AdminShell
      viewer={viewer}
      active="sources"
      title={`${t("detailTitle")} · ${src.landlord.name}`}
      actions={
        <>
          <ActionButton action={runSourceSync.bind(null, locale, src.id)} variant="dark">
            {t("runSync")}
          </ActionButton>
          {src.status === "needs_review" ? (
            <ActionButton action={markSourceReviewed.bind(null, locale, src.id)} variant="primary">
              {t("markReviewed")}
            </ActionButton>
          ) : null}
          {lead ? (
            src.status === "disabled" ? (
              <ActionButton action={setSourceStatus.bind(null, locale, src.id, "active")}>{t("enable")}</ActionButton>
            ) : (
              <ConfirmActionButton action={setSourceStatus.bind(null, locale, src.id, "disabled")} variant="danger" title={t("disable")} confirmLabel={t("disable")}>
                {t("disable")}
              </ConfirmActionButton>
            )
          ) : null}
        </>
      }
    >
      {src.status === "needs_review" ? (
        <div className="mb-4">
          <Callout tone="info" icon={icons.info}>
            {t("reviewNote")}
          </Callout>
        </div>
      ) : null}
      {!lead ? <p className="mb-4 text-meta text-muted">{t("leadOnly")}</p> : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <dl className="grid gap-x-8 gap-y-3 text-[14px] sm:grid-cols-2">
              <div>
                <dt className="text-meta text-muted">{t("url")}</dt>
                <dd className="break-all font-mono text-[13px]">
                  <a href={src.url ?? "#"} target="_blank" rel="noopener noreferrer">
                    {src.url}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("colStatus")}</dt>
                <dd>
                  <SourceStatusPill status={src.status} />
                </dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("colLandlord")}</dt>
                <dd>
                  <Link href={{ pathname: "/admin/landlords/[id]", params: { id: src.landlordId } }}>{src.landlord.name}</Link>
                </dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("adapter")}</dt>
                <dd className="font-mono text-[13px]">{src.adapter}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("interval")}</dt>
                <dd>{interval}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("techContact")}</dt>
                <dd>{src.techContactEmail ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("consent")}</dt>
                <dd>{t(`consent${src.consent[0].toUpperCase()}${src.consent.slice(1)}` as "consentUnknown")}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("queueDefault")}</dt>
                <dd>{src.queueDefault ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("lastRun")}</dt>
                <dd>{src.lastRunAt ? formatDateTime(locale, src.lastRunAt) : t("never")}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("lastSuccess")}</dt>
                <dd>{src.lastSuccessAt ? formatDateTime(locale, src.lastSuccessAt) : t("never")}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t("consecutiveFailures")}</dt>
                <dd className={src.consecutiveFailures ? "font-[700] text-error-text" : ""}>{src.consecutiveFailures}</dd>
              </div>
              {src.lastError ? (
                <div className="sm:col-span-2">
                  <dt className="text-meta text-muted">{t("colError")}</dt>
                  <dd className="font-mono text-[13px] text-error-text">{src.lastError}</dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <section aria-labelledby="runs">
            <h2 id="runs" className="text-h3">
              {t("runsTitle")}
            </h2>
            <div className="mt-2">
              <Table minWidth={720}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>{t("colStarted")}</Th>
                    <Th right>{t("colDuration")}</Th>
                    <Th>{t("colResult")}</Th>
                    <Th right>{t("colFound")}</Th>
                    <Th right>{t("colNew")}</Th>
                    <Th right>{t("colGone")}</Th>
                    <Th>{t("colError")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {src.runs.length ? (
                    src.runs.map((r) => (
                      <tr key={r.id} className="border-b border-hairline last:border-0">
                        <Td>{formatDateTimeShort(locale, r.startedAt)}</Td>
                        <Td right>{r.finishedAt ? `${Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)} s` : "—"}</Td>
                        <Td>
                          <StatusPill tone={r.ok ? (r.anomaly ? "info" : "success") : r.ok === false ? "error" : "neutral"}>{r.ok ? (r.anomaly ? t("statusReview") : t("ok")) : r.ok === false ? t("failed") : "…"}</StatusPill>
                        </Td>
                        <Td right>{r.listingsFound ?? "—"}</Td>
                        <Td right>{r.listingsNew ?? "—"}</Td>
                        <Td right>{r.listingsGone ?? "—"}</Td>
                        <Td className="max-w-[260px] truncate font-mono text-[12.5px] text-error-text">{r.errorDetail ?? ""}</Td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <Td className="text-muted">{t("noRuns")}</Td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          </section>

          <section aria-labelledby="src-listings">
            <h2 id="src-listings" className="text-h3">
              {t("listingsTitle")}
            </h2>
            <div className="mt-2">
              <Table minWidth={640}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>{tp("fieldExternalId")}</Th>
                    <Th>{tp("fieldAddress")}</Th>
                    <Th>{t("colStatus")}</Th>
                    <Th>{t("lastRun")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((l) => (
                    <tr key={l.id} className="border-b border-hairline last:border-0">
                      <Td className="font-mono text-[12.5px]">{l.externalId}</Td>
                      <Td>
                        <Link href={{ pathname: "/admin/listings/[id]", params: { id: l.id } }}>{l.address}</Link>
                      </Td>
                      <Td>
                        <ListingStatusPill status={l.status} />
                      </Td>
                      <Td>{formatDateTimeShort(locale, l.lastCheckedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </section>
        </div>

        <aside>
          <Card className="p-5">
            <h2 className="text-h3">{(await getTranslations("admin.settings"))("title")}</h2>
            <div className="mt-3">
              <SourceSettingsForm source={{ id: src.id, url: src.url ?? "", adapter: src.adapter, fetchIntervalMinutes: src.fetchIntervalMinutes, techContactEmail: src.techContactEmail ?? "", queueDefault: src.queueDefault ?? "", consent: src.consent, listSelector: String((src.config as { listSelector?: string }).listSelector ?? "") }} canEdit={lead} />
            </div>
          </Card>
        </aside>
      </div>
    </AdminShell>
  );
}

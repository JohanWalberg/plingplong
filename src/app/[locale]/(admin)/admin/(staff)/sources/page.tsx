import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { ActionButton } from "@/components/admin/action-buttons";
import { SourceStatusPill } from "@/components/admin/source-status";
import { listSources } from "@/lib/queries/admin";
import { runSourceSync } from "@/actions/admin";
import { formatDateTimeShort } from "@/lib/format";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminSourcesPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.sources");
  const sources = await listSources({ q: sp.q, status: sp.status });
  const statuses = ["active", "degraded", "failed", "needs_review", "disabled", "pending"] as const;
  return (
    <AdminShell
      viewer={viewer}
      active="sources"
      title={t("title")}
      actions={
        viewer.role === "lead" ? (
          <Link href="/admin/sources/new" className={buttonClasses("primary", "sm")}>
            {t("newSource")}
          </Link>
        ) : null
      }
    >
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-label font-[650]">
          <span className="sr-only">{t("filterPlaceholder")}</span>
          <input name="q" defaultValue={sp.q ?? ""} placeholder={t("filterPlaceholder")} className={`${inputClasses} min-w-[260px]`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="sr-only">{t("colStatus")}</span>
          <select name="status" defaultValue={sp.status ?? ""} className={inputClasses}>
            <option value="">{t("allStatuses")}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s === "needs_review" ? t("statusReview") : s === "pending" ? t("statusPending") : t(`status${s[0].toUpperCase()}${s.slice(1)}` as "statusActive")}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClasses("secondary", "md")}>
          {(await getTranslations("common"))("search")}
        </button>
      </form>
      <div className="mt-4">
        <Table minWidth={900}>
          <thead>
            <tr className="border-b border-line">
              <Th>{t("colSource")}</Th>
              <Th>{t("colLandlord")}</Th>
              <Th>{t("colType")}</Th>
              <Th>{t("colStatus")}</Th>
              <Th right>{t("colListings")}</Th>
              <Th>{t("colLastSync")}</Th>
              <Th right>{t("colErrors")}</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {sources.length ? (
              sources.map((s) => (
                <tr key={s.id} className="border-b border-hairline last:border-0">
                  <Td>
                    <Link href={{ pathname: "/admin/sources/[id]", params: { id: s.id } }} className="font-mono text-[13px]">
                      {s.url?.replace(/^https?:\/\//, "")}
                    </Link>
                    {s.lastError ? <p className="mt-0.5 max-w-[320px] truncate text-meta text-error-text">{s.lastError}</p> : null}
                  </Td>
                  <Td>
                    <Link href={{ pathname: "/admin/landlords/[id]", params: { id: s.landlordId } }}>{s.landlordName}</Link>
                  </Td>
                  <Td>{t(s.kind === "feed" ? "typeFeed" : s.kind === "api" ? "typeApi" : "typeHtml")}</Td>
                  <Td>
                    <SourceStatusPill status={s.status} />
                  </Td>
                  <Td right>{s.listings}</Td>
                  <Td>{s.lastRunAt ? formatDateTimeShort(locale, s.lastRunAt) : t("never")}</Td>
                  <Td right className={s.errors24h ? "font-[700] text-error-text" : "text-muted"}>
                    {s.errors24h || "—"}
                  </Td>
                  <Td right>
                    <ActionButton action={runSourceSync.bind(null, locale, s.id)}>{t("runSync")}</ActionButton>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <Td className="text-muted">{t("empty")}</Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
    </AdminShell>
  );
}

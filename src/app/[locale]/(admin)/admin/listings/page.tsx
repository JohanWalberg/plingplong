import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { listListingsAdmin } from "@/lib/queries/admin";
import { formatDateTimeShort, formatSek } from "@/lib/format";
import { StatusPill, type StatusTone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

const tones: Record<string, StatusTone> = { active: "success", removed: "quiet", draft: "neutral", unpublished: "neutral", expired: "neutral", unknown: "warning" };

export default async function AdminListingsPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.listings");
  const tc = await getTranslations("common");
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const { rows, pages, total } = await listListingsAdmin({ q: sp.q, status: sp.status, page });
  return (
    <AdminShell viewer={viewer} active="listings" title={`${t("title")} · ${total}`}>
      <form method="get" className="flex flex-wrap gap-3">
        <input name="q" defaultValue={sp.q ?? ""} placeholder={t("filterPlaceholder")} aria-label={t("filterPlaceholder")} className={`${inputClasses} max-w-[360px]`} />
        <select name="status" defaultValue={sp.status ?? ""} aria-label={t("colStatus")} className={`${inputClasses} max-w-[200px]`}>
          <option value="">{t("allStatuses")}</option>
          {["active", "removed", "draft", "unpublished", "expired", "unknown"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary")}>
          {tc("search")}
        </button>
      </form>
      <div className="mt-4">
        <Table minWidth={960}>
          <thead>
            <tr className="border-b border-line">
              <Th>{t("colAddress")}</Th>
              <Th>{t("colLandlord")}</Th>
              <Th right>{t("colRent")}</Th>
              <Th>{t("colStatus")}</Th>
              <Th right>{t("colSources")}</Th>
              <Th>{t("colFirstSeen")}</Th>
              <Th>{t("colLastChecked")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <Td>
                  <Link href={{ pathname: "/admin/listings/[id]", params: { id: r.id } }} className="font-[600]">
                    {r.address}
                  </Link>
                  <span className="ml-2 text-meta text-muted">{r.municipality}</span>
                </Td>
                <Td>{r.landlordName}</Td>
                <Td right>{r.rentMonthly === null ? "—" : formatSek(locale, r.rentMonthly)}</Td>
                <Td>
                  <StatusPill tone={tones[r.status] ?? "neutral"}>{r.status}</StatusPill>
                </Td>
                <Td right>{r.publishedDirectly ? "portal" : r.sources}</Td>
                <Td>{formatDateTimeShort(locale, r.firstSeenAt)}</Td>
                <Td>{formatDateTimeShort(locale, r.lastCheckedAt)}</Td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <Td className="text-muted">{t("empty")}</Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between text-[13.5px]" aria-label={tc("page", { page, total: pages })}>
          {page > 1 ? <Link href={{ pathname: "/admin/listings", query: { ...sp, page: String(page - 1) } }} className={buttonClasses("secondary", "sm")}>{tc("previousPage")}</Link> : <span />}
          <span className="text-muted">{tc("page", { page, total: pages })}</span>
          {page < pages ? <Link href={{ pathname: "/admin/listings", query: { ...sp, page: String(page + 1) } }} className={buttonClasses("secondary", "sm")}>{tc("nextPage")}</Link> : <span />}
        </nav>
      ) : null}
    </AdminShell>
  );
}

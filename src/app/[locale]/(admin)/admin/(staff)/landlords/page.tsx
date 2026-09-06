import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { formatDateShort } from "@/lib/format";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { listLandlords } from "@/lib/queries/admin";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/badge";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | undefined>> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLandlordsPage({ params, searchParams }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const sp = await searchParams;
  const t = await getTranslations("admin.landlords");
  const tl = await getTranslations("landlord");
  const rows = await listLandlords(sp.q);
  return (
    <AdminShell viewer={viewer} active="landlords" title={t("title")} actions={viewer.role === "lead" ? <Link href="/admin/landlords/new" className={buttonClasses("primary", "sm")}>{t("new")}</Link> : null}>
      <form method="get" className="flex gap-3">
        <input name="q" defaultValue={sp.q ?? ""} placeholder={t("colName")} className={`${inputClasses} max-w-[320px]`} aria-label={t("colName")} />
        <button type="submit" className={buttonClasses("secondary")}>
          {(await getTranslations("common"))("search")}
        </button>
      </form>
      <div className="mt-4">
        <Table minWidth={860}>
          <thead>
            <tr className="border-b border-line">
              <Th>{t("colName")}</Th>
              <Th>{t("colOrg")}</Th>
              <Th>{t("colType")}</Th>
              <Th right>{t("colMunicipalities")}</Th>
              <Th>{t("colMonitored")}</Th>
              <Th right>{t("colListings")}</Th>
              <Th right>{t("colSources")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-hairline last:border-0">
                <Td>
                  <Link href={{ pathname: "/admin/landlords/[id]", params: { id: r.id } }} className="font-[600]">
                    {r.name}
                  </Link>
                  {r.approvedAt ? <span className="ml-2 text-meta text-muted">{t("approvedAt", { date: formatDateShort(locale, r.approvedAt) })}</span> : null}
                </Td>
                <Td className="font-mono text-[12.5px]">{r.orgNumber ?? "—"}</Td>
                <Td>{tl(`type${r.type[0].toUpperCase()}${r.type.slice(1)}` as "typePrivate")}</Td>
                <Td right>{r.municipalities}</Td>
                <Td>
                  <StatusPill tone={r.isMonitored ? "success" : "quiet"}>{r.isMonitored ? t("monitored") : r.isKnown ? t("known") : t("no")}</StatusPill>
                </Td>
                <Td right>{r.listings}</Td>
                <Td right>{r.sources}</Td>
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
    </AdminShell>
  );
}

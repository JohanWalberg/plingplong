import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { coverageTable } from "@/app/[locale]/(public)/coverage/page";
import { municipalityName, municipalitySlug } from "@/lib/queries/places";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminCoveragePage({ params }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const t = await getTranslations("admin.coverage");
  const rows = await coverageTable();
  return (
    <AdminShell viewer={viewer} active="coverage" title={t("title")}>
      <p className="max-w-[70ch] text-[14px] text-ink-2">{t("intro")}</p>
      <div className="mt-4">
        <Table minWidth={640}>
          <thead>
            <tr className="border-b border-line">
              <Th>{t("colMunicipality")}</Th>
              <Th right>{t("colKnown")}</Th>
              <Th right>{t("colMonitored")}</Th>
              <Th>{t("colRatio")}</Th>
              <Th right>{t("colListings")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const pct = r.known ? Math.round((r.monitored / r.known) * 100) : 0;
              return (
                <tr key={r.m.id} className="border-b border-hairline last:border-0">
                  <Td>
                    <Link href={{ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(r.m, locale) } }} className="font-[600]">
                      {municipalityName(r.m, locale)}
                    </Link>
                  </Td>
                  <Td right>{r.known}</Td>
                  <Td right>{r.monitored}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-placeholder" aria-hidden="true">
                        <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-meta text-muted tabular">{pct}%</span>
                    </div>
                  </Td>
                  <Td right>{r.listings}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div>
    </AdminShell>
  );
}

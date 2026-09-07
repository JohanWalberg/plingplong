import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { StaffForm, StaffRoleSelect } from "@/components/admin/staff-form";
import { ConfirmActionButton } from "@/components/admin/action-buttons";
import { removeStaff } from "@/actions/admin";
import { listStaff } from "@/lib/queries/admin";
import { Card } from "@/components/ui/misc";
import { USER_AGENT } from "@/worker/fetch";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminSettingsPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const t = await getTranslations("admin.settings");
  const staff = await listStaff();
  const lead = viewer.role === "lead";
  return (
    <AdminShell viewer={viewer} active="settings" title={t("title")}>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <section aria-labelledby="staff">
          <h2 id="staff" className="text-h3">
            {t("staffTitle")}
          </h2>
          <div className="mt-2">
            <Table minWidth={520}>
              <thead>
                <tr className="border-b border-line">
                  <Th>{t("colName")}</Th>
                  <Th>{t("colEmail")}</Th>
                  <Th>{t("colRole")}</Th>
                  {lead ? <Th right>{t("colActions")}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.userId} className="border-b border-hairline last:border-0">
                    <Td>{s.user.name}</Td>
                    <Td>{s.user.email}</Td>
                    <Td>{lead && s.userId !== viewer.userId ? <StaffRoleSelect userId={s.userId} role={s.role} /> : t(`role${s.role[0].toUpperCase()}${s.role.slice(1)}` as "roleLead")}</Td>
                    {lead ? (
                      <Td right>
                        {s.userId !== viewer.userId ? (
                          <ConfirmActionButton action={removeStaff.bind(null, locale, s.userId)} variant="danger" title={t("removeTitle")} body={t("removeBody", { name: s.user.name })} confirmLabel={t("remove")} successMessage={t("removed")}>
                            {t("remove")}
                          </ConfirmActionButton>
                        ) : null}
                      </Td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {lead ? (
            <Card className="mt-4 max-w-[520px] p-5">
              <h3 className="text-h3">{t("invite")}</h3>
              <div className="mt-3">
                <StaffForm />
              </div>
            </Card>
          ) : null}
        </section>
        <aside>
          <Card className="p-5 text-[14px]">
            <p className="text-meta text-muted">{t("userAgent")}</p>
            <p className="mt-1 break-all font-mono text-[12.5px]">{USER_AGENT}</p>
            <p className="mt-3 text-muted">{t("retention", { days: 90 })}</p>
          </Card>
        </aside>
      </div>
    </AdminShell>
  );
}

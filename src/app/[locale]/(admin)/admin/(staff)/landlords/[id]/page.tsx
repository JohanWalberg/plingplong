import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell, Table, Td, Th } from "@/components/admin/admin-shell";
import { LandlordForm } from "@/components/admin/landlord-form";
import { SourceStatusPill } from "@/components/admin/source-status";
import { getLandlordAdmin } from "@/lib/queries/admin";
import { listMunicipalities, municipalityName } from "@/lib/queries/places";
import { Card } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLandlordPage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale);
  const l = await getLandlordAdmin(id);
  if (!l) notFound();
  const t = await getTranslations("admin.landlords");
  const ts = await getTranslations("admin.sources");
  const ta = await getTranslations("portal.account");
  const munis = (await listMunicipalities()).map((m) => ({ id: m.id, name: municipalityName(m, locale) }));
  return (
    <AdminShell viewer={viewer} active="landlords" title={l.name} actions={<Link href={{ pathname: "/landlords/[slug]", params: { slug: l.slug } }} className={buttonClasses("secondary", "sm")}>{(await getTranslations("admin.listings"))("publicPage")}</Link>}>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card className="p-6">
          <LandlordForm
            values={{ id: l.id, name: l.name, orgNumber: l.orgNumber ?? "", website: l.website ?? "", type: l.type, queueType: l.queueType, queueInfoUrl: l.queueInfoUrl ?? "", isKnown: l.isKnown, municipalityIds: l.municipalities.map((m) => m.municipalityId) }}
            municipalities={munis}
            canEdit={viewer.role === "lead"}
          />
        </Card>
        <div className="flex flex-col gap-6">
          <section aria-labelledby="ll-sources">
            <h2 id="ll-sources" className="text-h3">
              {t("sourcesTitle")}
            </h2>
            <div className="mt-2">
              <Table minWidth={360}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>{ts("colSource")}</Th>
                    <Th>{ts("colStatus")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {l.sources.map((s) => (
                    <tr key={s.id} className="border-b border-hairline last:border-0">
                      <Td>
                        <Link href={{ pathname: "/admin/sources/[id]", params: { id: s.id } }} className="font-mono text-[12.5px]">
                          {s.url?.replace(/^https?:\/\//, "") ?? s.kind}
                        </Link>
                      </Td>
                      <Td>
                        <SourceStatusPill status={s.status} />
                      </Td>
                    </tr>
                  ))}
                  {!l.sources.length ? (
                    <tr>
                      <Td className="text-muted">—</Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </section>
          <section aria-labelledby="ll-members">
            <h2 id="ll-members" className="text-h3">
              {t("membersTitle")}
            </h2>
            <div className="mt-2">
              <Table minWidth={360}>
                <thead>
                  <tr className="border-b border-line">
                    <Th>{ta("name")}</Th>
                    <Th>{ta("email")}</Th>
                    <Th>{ta("inviteRole")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {l.members.map((m) => (
                    <tr key={m.userId} className="border-b border-hairline last:border-0">
                      <Td>{m.user.name}</Td>
                      <Td>{m.user.email}</Td>
                      <Td>{m.role === "owner" ? ta("roleOwner") : ta("roleEditor")}</Td>
                    </tr>
                  ))}
                  {!l.members.length ? (
                    <tr>
                      <Td className="text-muted">{t("noMembers")}</Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

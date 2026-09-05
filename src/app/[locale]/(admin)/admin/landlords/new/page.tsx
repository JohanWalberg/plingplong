import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell } from "@/components/admin/admin-shell";
import { LandlordForm } from "@/components/admin/landlord-form";
import { Card } from "@/components/ui/misc";
import { listMunicipalities, municipalityName } from "@/lib/queries/places";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NewLandlordPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale, "lead");
  const t = await getTranslations("admin.landlords");
  const munis = (await listMunicipalities()).map((m) => ({ id: m.id, name: municipalityName(m, locale) }));
  return (
    <AdminShell viewer={viewer} active="landlords" title={t("new")}>
      <Card className="max-w-[720px] p-6">
        <p className="mb-4 text-[14px] text-ink-2">{t("createHint")}</p>
        <LandlordForm values={{ name: "", orgNumber: "", website: "", type: "private", queueType: "unknown", queueInfoUrl: "", isKnown: true, municipalityIds: [] }} municipalities={munis} canEdit />
      </Card>
    </AdminShell>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { requireStaff } from "@/lib/access";
import { AdminShell } from "@/components/admin/admin-shell";
import { SourceSettingsForm } from "@/components/admin/source-settings-form";
import { Card } from "@/components/ui/misc";
import { db } from "@/db";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function NewSourcePage({ params }: Props) {
  const locale = await resolveLocale(params);
  const viewer = await requireStaff(locale, "lead");
  const t = await getTranslations("admin.sources");
  const landlords = await db.query.landlord.findMany({ columns: { id: true, name: true }, orderBy: (l, { asc }) => [asc(l.name)] });
  return (
    <AdminShell viewer={viewer} active="sources" title={t("newSource")}>
      <Card className="max-w-[640px] p-6">
        <SourceSettingsForm source={{ url: "", adapter: "generic-xml", fetchIntervalMinutes: 60, techContactEmail: "", queueDefault: "", consent: "unknown", listSelector: "", kind: "feed" }} canEdit landlords={landlords} />
      </Card>
    </AdminShell>
  );
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { resolveLocale } from "@/lib/locale";
import { isOwner, requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { ListingForm } from "@/components/portal/listing-form";
import { municipalityOptions } from "@/lib/queries/portal";

type Props = { params: Promise<{ locale: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function NewHomePage({ params }: Props) {
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const t = await getTranslations("portal.add");
  const munis = await municipalityOptions();
  return (
    <PortalShell viewer={me} active="homes">
      <h1 className="font-serif text-[32px] leading-tight">{t("title")}</h1>
      <p className="mt-1 mb-6 text-meta text-muted">{t("autosave")}</p>
      <ListingForm
        existingId={null}
        status={null}
        initial={{ address: "", postcode: "", municipalityId: "", areaName: "", rentMonthly: "", rooms: "", sizeSqm: "", floor: "", moveInDate: "", applicationDeadline: "", segment: "none", description: "", queueRequirement: "unknown", applyRoute: "url", applicationUrl: "", applicationContact: "" }}
        municipalities={munis.map((m) => ({ id: m.id, label: locale === "sv" ? m.nameSv : m.nameEn }))}
        images={[]}
        landlordName={me.landlordName}
        canPublish={isOwner(me)}
      />
    </PortalShell>
  );
}

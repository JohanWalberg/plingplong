import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { isOwner, requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { ListingForm } from "@/components/portal/listing-form";
import { landlordListing, municipalityOptions } from "@/lib/queries/portal";
import { storage } from "@/lib/storage";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function EditHomePage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const l = await landlordListing(me.landlordId, id);
  if (!l) notFound();
  if (!l.publishedDirectly) redirect({ href: { pathname: "/portal/homes/[id]", params: { id } }, locale });
  // Editors may only edit drafts; published homes need an owner.
  if (!isOwner(me) && l.status !== "draft") redirect({ href: { pathname: "/portal/homes/[id]", params: { id } }, locale });
  const t = await getTranslations("portal.add");
  const munis = await municipalityOptions();
  return (
    <PortalShell viewer={me} active="homes">
      <h1 className="mb-6 font-serif text-[32px] leading-tight">{t("editTitle")}</h1>
      <ListingForm
        existingId={l.id}
        status={l.status}
        initial={{
          address: l.address,
          postcode: l.postcode ?? "",
          municipalityId: l.municipalityId,
          areaName: l.areaName ?? "",
          rentMonthly: l.rentMonthly?.toString() ?? "",
          rooms: l.rooms?.toString() ?? "",
          sizeSqm: l.sizeSqm?.toString() ?? "",
          floor: l.floor?.toString() ?? "",
          moveInDate: l.moveInDate ?? "",
          applicationDeadline: l.applicationDeadline ?? "",
          segment: l.segment,
          description: l.description ?? "",
          queueRequirement: l.queueRequirement,
          applyRoute: l.applyRoute,
          applicationUrl: l.applicationUrl ?? "",
          applicationContact: l.applicationContact ?? "",
        }}
        municipalities={munis.map((m) => ({ id: m.id, label: locale === "sv" ? m.nameSv : m.nameEn }))}
        images={l.images.map((i) => ({ id: i.id, url: storage.url(i.storageKey) }))}
        landlordName={me.landlordName}
        canPublish={isOwner(me)}
      />
    </PortalShell>
  );
}

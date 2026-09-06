import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { requireLandlord } from "@/lib/access";
import { PortalShell } from "@/components/portal/portal-shell";
import { ListingCard } from "@/components/listing/listing-card";
import { Badge } from "@/components/ui/badge";
import { Card, icons } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { landlordListing } from "@/lib/queries/portal";
import { municipalityName } from "@/lib/queries/places";
import { storage } from "@/lib/storage";

type Props = { params: Promise<{ locale: string; id: string }> };
export const metadata: Metadata = { robots: { index: false } };

export default async function PublishedPage({ params }: Props) {
  const { id } = await params;
  const locale = await resolveLocale(params);
  const me = await requireLandlord(locale);
  const l = await landlordListing(me.landlordId, id);
  if (!l) notFound();
  const t = await getTranslations("portal.confirm");
  const place = municipalityName(l.municipality, locale);
  return (
    <PortalShell viewer={me} active="homes">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-6 sm:p-8">
          <Badge tone="info" icon="clock">
            <span className="text-success">{icons.check}</span>
            {t("tag")}
          </Badge>
          <h1 className="mt-3 font-serif text-[34px] leading-tight">{t("title")}</h1>
          <p className="mt-2 text-ink-2">{t("body", { address: l.address, place })}</p>
          <h2 className="mt-6 text-h3">{t("nextTitle")}</h2>
          <ol className="mt-2 flex flex-col gap-2 text-[14.5px] text-ink-2">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="flex gap-3">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-[12px] font-[700] tabular text-ink">{n}</span>
                {t(`next${n}`, { place })}
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/portal/homes" className={buttonClasses("primary")}>{t("toDash")}</Link>
            <Link href="/portal/homes/new" className={buttonClasses("secondary")}>{t("addAnother")}</Link>
          </div>
        </Card>
        <aside>
          <Card className="p-5">
            <h2 className="text-h3">{t("previewTitle")}</h2>
            <div className="mt-3">
              <ListingCard
                variant="home"
                listing={{
                  slug: l.slug,
                  address: l.address,
                  areaName: l.areaName,
                  municipalityName: place,
                  rentMonthly: l.rentMonthly,
                  rooms: l.rooms,
                  sizeSqm: l.sizeSqm,
                  imageUrl: l.imageUrl ?? (l.images[0] ? storage.url(l.images[0].storageKey) : null),
                  landlordName: me.landlordName,
                  landlordSlug: me.landlordSlug,
                  lastCheckedAt: l.lastCheckedAt,
                  applicationDeadline: l.applicationDeadline,
                  queueRequirement: l.queueRequirement,
                  contractType: l.contractType,
                  segment: l.segment,
                  firstSeenAt: l.firstSeenAt,
                  publishedDirectly: true,
                }}
              />
            </div>
            <p className="mt-2 text-meta text-muted">{t("previewNote")}</p>
          </Card>
        </aside>
      </div>
    </PortalShell>
  );
}

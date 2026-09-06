"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { BadgeList } from "@/components/ui/badge";
import { icons } from "@/components/ui/misc";
import { composeBadges, rentLabel, roomsSizeLabel, type BadgeLabels } from "@/lib/listing-display";
import type { QueueRequirement, Segment } from "@/db/schema";

export type PreviewData = {
  address: string;
  areaName: string | null;
  municipalityName: string;
  rentMonthly: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  imageUrl: string | null;
  landlordName: string;
  applicationDeadline: string | null;
  queueRequirement: QueueRequirement;
  segment: Segment;
};

/** Client-side listing card used for live previews in the portal form. */
export function CardPreview({ data }: { data: PreviewData }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("listing");
  const tb = useTranslations("badges");
  const tf = useTranslations("freshness");
  const labels: BadgeLabels = {
    closingToday: tb("closingToday"),
    closing: tb("closing"),
    noQueue: tb("noQueue"),
    queue: tb("queue"),
    points: tb("points"),
    unknownQueue: tb("unknownQueue"),
    first: tb("first"),
    sublet: tb("sublet"),
    student: tb("student"),
    youth: tb("youth"),
    senior: tb("senior"),
    accessible: tb("accessible"),
    new: tb("new"),
    direct: tb("direct"),
  };
  const badges = composeBadges({ ...data, contractType: "first_hand", firstSeenAt: new Date(0), publishedDirectly: true }, labels, 3);
  const place = data.areaName ? `${data.areaName}, ${data.municipalityName}` : data.municipalityName;
  return (
    <article className="overflow-hidden rounded-md border border-line bg-surface">
      {data.imageUrl ? (
        <span className="relative block h-[132px] w-full overflow-hidden">
          <Image src={data.imageUrl} alt="" fill sizes="(min-width: 1024px) 360px, 100vw" unoptimized={!data.imageUrl.startsWith("/")} className="object-cover" />
        </span>
      ) : (
        <div className="flex h-[132px] items-center justify-center bg-placeholder text-meta text-faint">{t("noImage")}</div>
      )}
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[20px] font-[700] leading-none tabular">{rentLabel(locale, data.rentMonthly, t("rentUnknown"))}</p>
          <p className="text-meta text-muted">{roomsSizeLabel(locale, data.rooms, data.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") })}</p>
        </div>
        <p className="text-h3 leading-snug">{data.address || "—"}</p>
        <p className="text-meta text-muted">{place}</p>
        <BadgeList badges={badges} />
        <div className="flex items-center justify-between gap-3 pt-1 text-meta text-muted">
          <span className="truncate">{data.landlordName}</span>
          <span className="inline-flex items-center gap-1.5">
            {icons.refresh}
            {tf("justNow")}
          </span>
        </div>
      </div>
    </article>
  );
}

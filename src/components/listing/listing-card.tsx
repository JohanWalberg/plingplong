import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Badge, BadgeList } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Freshness } from "./freshness";
import { composeBadges, deadlineMessage, deadlineState, initials, rentLabel, roomsSizeLabel, type BadgeLabels } from "@/lib/listing-display";
import type { QueueRequirement, Segment } from "@/db/schema";

export type ListingCardData = {
  slug: string;
  address: string;
  areaName: string | null;
  municipalityName: string;
  rentMonthly: number | null;
  rooms: number | null;
  sizeSqm: number | null;
  imageUrl: string | null;
  landlordName: string;
  landlordSlug: string;
  lastCheckedAt: Date;
  applicationDeadline: string | null;
  queueRequirement: QueueRequirement;
  contractType: "first_hand" | "sublet";
  segment: Segment;
  firstSeenAt: Date;
  publishedDirectly: boolean;
};

export async function getBadgeLabels(): Promise<BadgeLabels> {
  const t = await getTranslations("badges");
  return {
    closingToday: t("closingToday"),
    closing: t("closing"),
    noQueue: t("noQueue"),
    queue: t("queue"),
    points: t("points"),
    unknownQueue: t("unknownQueue"),
    first: t("first"),
    sublet: t("sublet"),
    student: t("student"),
    youth: t("youth"),
    senior: t("senior"),
    accessible: t("accessible"),
    new: t("new"),
    direct: t("direct"),
  };
}

function ImageArea({ imageUrl, address, noImage, className }: { imageUrl: string | null; address: string; noImage: string; className: string }) {
  if (imageUrl) {
    // Hotlinked from the landlord's own site; we never copy photos.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" loading="lazy" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} flex items-center justify-center bg-placeholder text-center text-meta text-faint`} aria-label={`${address}: ${noImage}`} role="img">
      <span className="px-3">{noImage}</span>
    </div>
  );
}

function DeadlinePill({ deadline, locale, t }: { deadline: string | null; locale: Locale; t: Awaited<ReturnType<typeof getTranslations<"deadline">>> }) {
  const s = deadlineState(deadline);
  const m = deadlineMessage(locale, deadline);
  const icon = s.tone === "urgent" ? "warn" : s.tone === "soon" ? "clock" : undefined;
  return (
    <Badge tone={s.tone} icon={icon}>
      {t(m.key, m.values as never)}
    </Badge>
  );
}

/** Full result card: image column plus details. Works with and without a photo. */
export async function ListingCard({ listing, variant = "result" }: { listing: ListingCardData; variant?: "result" | "compact" | "home" }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("listing");
  const ta = await getTranslations("actions");
  const td = await getTranslations("deadline");
  const labels = await getBadgeLabels();
  const badges = composeBadges(listing, labels, variant === "compact" ? 2 : 3);
  const rent = rentLabel(locale, listing.rentMonthly, t("rentUnknown"));
  const roomsSize = roomsSizeLabel(locale, listing.rooms, listing.sizeSqm, { roomsUnknown: t("roomsUnknown"), sizeUnknown: t("sizeUnknown") });
  const href = { pathname: "/home/[slug]", params: { slug: listing.slug } } as const;
  const place = listing.areaName ? `${listing.areaName}, ${listing.municipalityName}` : listing.municipalityName;

  if (variant === "home" || variant === "compact") {
    return (
      <article className="group relative flex flex-col overflow-hidden rounded-md border border-line bg-surface transition-shadow hover:shadow-[0_2px_8px_rgba(26,24,21,.08)]">
        <ImageArea imageUrl={listing.imageUrl} address={listing.address} noImage={t("noImage")} className="h-[132px] w-full" />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[20px] font-[700] leading-none tabular text-ink">{rent}</p>
            <p className="text-meta text-muted">{roomsSize}</p>
          </div>
          <h3 className="text-h3 leading-snug">
            <Link href={href} className="text-ink after:absolute after:inset-0 hover:text-ink hover:no-underline">
              {listing.address}
            </Link>
          </h3>
          <p className="text-meta text-muted">{place}</p>
          <BadgeList badges={badges} />
          <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-meta text-muted">
            <span className="truncate">{listing.landlordName}</span>
            <Freshness lastCheckedAt={listing.lastCheckedAt} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="group relative grid grid-cols-1 overflow-hidden rounded-md border border-line bg-surface transition-shadow hover:shadow-[0_2px_8px_rgba(26,24,21,.08)] sm:grid-cols-[212px_1fr]">
      <ImageArea imageUrl={listing.imageUrl} address={listing.address} noImage={t("noImage")} className="h-[150px] w-full sm:h-full sm:min-h-[158px]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h3 className="text-h2 leading-snug">
              <Link href={href} className="text-ink after:absolute after:inset-0 hover:text-ink hover:no-underline">
                {listing.address}
              </Link>
            </h3>
            <p className="text-[14px] text-muted">{place}</p>
          </div>
          <div className="text-right">
            <p className="text-price font-[700] tabular text-ink">{rent}</p>
            <p className="mt-1 text-meta text-muted">{roomsSize}</p>
          </div>
        </div>
        <BadgeList badges={badges} />
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 text-meta text-muted">
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] bg-surface-muted text-[10px] font-[700] text-ink-2">
              {initials(listing.landlordName)}
            </span>
            <span className="truncate">{listing.landlordName}</span>
          </span>
          <Freshness lastCheckedAt={listing.lastCheckedAt} />
          <DeadlinePill deadline={listing.applicationDeadline} locale={locale} t={td} />
          <span className={`${buttonClasses("secondary", "sm")} relative z-10 ml-auto`} aria-hidden="true">
            {ta("viewListing")}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton({ variant = "result" }: { variant?: "result" | "home" }) {
  if (variant === "home") {
    return (
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <div className="skeleton h-[132px] w-full rounded-none" />
        <div className="flex flex-col gap-3 p-4">
          <div className="skeleton h-5 w-1/3" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-1/2" />
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 overflow-hidden rounded-md border border-line bg-surface sm:grid-cols-[212px_1fr]">
      <div className="skeleton h-[150px] w-full rounded-none sm:h-full" />
      <div className="flex flex-col gap-3 p-4">
        <div className="skeleton h-5 w-1/2" />
        <div className="skeleton h-4 w-1/3" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton mt-auto h-4 w-1/2" />
      </div>
    </div>
  );
}

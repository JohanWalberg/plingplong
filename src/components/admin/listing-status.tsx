import { getTranslations } from "next-intl/server";
import { StatusPill, type StatusTone } from "@/components/ui/badge";
import type { ListingStatus } from "@/db/schema";

/** Catalogue key per listing status; a map so a new status is a type error, not English in the UI. */
const KEYS = {
  draft: "statusDraft",
  active: "statusActive",
  unpublished: "statusUnpublished",
  expired: "statusExpired",
  removed: "statusRemoved",
  unknown: "statusUnknown",
} as const satisfies Record<ListingStatus, string>;

const TONES: Record<ListingStatus, StatusTone> = {
  draft: "neutral",
  active: "success",
  unpublished: "quiet",
  expired: "quiet",
  removed: "warning",
  unknown: "neutral",
};

/**
 * `takenDown` separates a staff takedown or a landlord objection from the
 * ordinary "gone at the source" removal. They share a status but not a
 * meaning, and only the takedown makes the public page disappear.
 */
export async function ListingStatusPill({ status, takenDown = false }: { status: ListingStatus; takenDown?: boolean }) {
  const t = await getTranslations("admin.listings");
  if (takenDown) return <StatusPill tone="error">{t("statusTakenDown")}</StatusPill>;
  return <StatusPill tone={TONES[status]}>{t(KEYS[status])}</StatusPill>;
}

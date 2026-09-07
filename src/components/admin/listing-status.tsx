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

export async function ListingStatusPill({ status }: { status: ListingStatus }) {
  const t = await getTranslations("admin.listings");
  return <StatusPill tone={TONES[status]}>{t(KEYS[status])}</StatusPill>;
}

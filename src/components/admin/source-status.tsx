import { getTranslations } from "next-intl/server";
import { StatusPill, type StatusTone } from "@/components/ui/badge";
import type { SourceStatus } from "@/db/schema";

const tones: Record<SourceStatus, StatusTone> = { active: "success", degraded: "warning", failed: "error", needs_review: "info", disabled: "quiet", pending: "neutral" };

export async function SourceStatusPill({ status }: { status: SourceStatus }) {
  const t = await getTranslations("admin.sources");
  const label = status === "needs_review" ? t("statusReview") : status === "pending" ? (await getTranslations("portal.source"))("statusPending") : t(`status${status[0].toUpperCase()}${status.slice(1)}` as "statusActive");
  return <StatusPill tone={tones[status]}>{label}</StatusPill>;
}

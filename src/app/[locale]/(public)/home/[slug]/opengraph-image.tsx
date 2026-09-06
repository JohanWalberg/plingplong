import { getTranslations } from "next-intl/server";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { resolveLocale } from "@/lib/locale";
import { getListingBySlug } from "@/lib/queries/listings";
import { municipalityName } from "@/lib/queries/places";
import { rentLabel } from "@/lib/listing-display";
import { formatRooms, formatSize } from "@/lib/format";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const [l, t, tn] = await Promise.all([getListingBySlug(slug), getTranslations({ locale, namespace: "listing" }), getTranslations({ locale, namespace: "navigation" })]);
  if (!l) return ogCard({ kicker: tn("search"), title: t("noImage") });
  const place = l.areaName ? `${l.areaName}, ${municipalityName(l.municipality, locale)}` : municipalityName(l.municipality, locale);
  const facts = [rentLabel(locale, l.rentMonthly, t("rentUnknown")), l.rooms !== null ? formatRooms(locale, l.rooms) : t("roomsUnknown"), l.sizeSqm !== null ? formatSize(locale, l.sizeSqm) : t("sizeUnknown")];
  return ogCard({ kicker: tn("search"), title: l.address, subtitle: place, facts, footer: `${t("landlord")}: ${l.landlord.name}` });
}

import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og";
import { resolveLocale } from "@/lib/locale";
import { listingsForLandlord } from "@/lib/queries/listings";
import { municipalityName } from "@/lib/queries/places";
import { formatNumber } from "@/lib/format";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const [l, t] = await Promise.all([
    db.query.landlord.findFirst({ where: eq(schema.landlord.slug, slug), with: { municipalities: { with: { municipality: { columns: { centroid: false, geom: false } } } } } }),
    getTranslations({ locale, namespace: "landlord" }),
  ]);
  if (!l) return ogCard({ kicker: t("kicker"), title: slug });
  const listings = await listingsForLandlord(locale, l.id);
  const places = l.municipalities.map((m) => municipalityName(m.municipality, locale)).slice(0, 4).join(" · ");
  return ogCard({
    kicker: t("kicker"),
    title: l.name,
    subtitle: places,
    facts: [`${formatNumber(locale, listings.length)} ${t("statListings").toLowerCase()}`, `${formatNumber(locale, l.municipalities.length)} ${t("statMunicipalities").toLowerCase()}`],
    footer: t("listingsTitle", { name: l.name }),
  });
}

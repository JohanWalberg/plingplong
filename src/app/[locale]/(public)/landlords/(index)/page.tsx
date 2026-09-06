import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { sql, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { StatusPill } from "@/components/ui/badge";

// Rendered at build time and refreshed every five minutes; listing changes from
// the portal and admin clear it immediately through invalidateListingCaches().
export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "landlord" });
  return { title: t("indexTitle"), alternates: alternatesFor(locale, () => "/landlords") };
}

export default async function LandlordsPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("landlord");
  const { landlord, listing } = schema;
  const rows = await db
    .select({ l: landlord, count: sql<number>`count(${listing.id})::int` })
    .from(landlord)
    .leftJoin(listing, and(eq(listing.landlordId, landlord.id), eq(listing.status, "active")))
    .where(eq(landlord.isKnown, true))
    .groupBy(landlord.id)
    .orderBy(sql`${landlord.isMonitored} desc`, sql`count(${listing.id}) desc`, landlord.name);

  const typeLabel = (type: string) => t(`type${type[0].toUpperCase()}${type.slice(1)}` as never);

  return (
    <>
      <SiteHeader active="landlords" />
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{t("indexTitle")}</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">{t("indexIntro")}</p>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ l, count }) => (
            <li key={l.id} className="list-none">
              <Link
                href={{ pathname: "/landlords/[slug]", params: { slug: l.slug } }}
                className="flex h-full flex-col gap-2 rounded-md border border-line bg-surface p-4 text-ink hover:border-line-strong hover:no-underline"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="text-[15px] font-[650] leading-snug">{l.name}</span>
                  <StatusPill tone={l.isMonitored ? "success" : "quiet"}>{l.isMonitored ? t("monitored") : t("notMonitoredShort")}</StatusPill>
                </span>
                <span className="text-meta text-muted">
                  {typeLabel(l.type)}
                  {l.isMonitored ? ` · ${count} ${t("statListings").toLowerCase()}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

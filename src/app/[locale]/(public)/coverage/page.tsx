import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { sql, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { municipalityName, municipalitySlug } from "@/lib/queries/places";

// Aggregates over all sources; refreshed every five minutes.
export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "coverage" });
  return { title: t("pageTitle"), alternates: alternatesFor(locale, () => "/coverage") };
}

export async function coverageTable() {
  const { municipality, landlordMunicipality, landlord, listing } = schema;
  return db
    .select({
      m: municipality,
      known: sql<number>`count(distinct ${landlord.id}) filter (where ${landlord.isKnown})::int`,
      monitored: sql<number>`count(distinct ${landlord.id}) filter (where ${landlord.isKnown} and ${landlord.isMonitored})::int`,
      listings: sql<number>`(select count(*) from ${listing} where ${listing.municipalityId} = ${municipality.id} and ${listing.status} = 'active')::int`,
    })
    .from(municipality)
    .leftJoin(landlordMunicipality, eq(landlordMunicipality.municipalityId, municipality.id))
    .leftJoin(landlord, and(eq(landlord.id, landlordMunicipality.landlordId)))
    .groupBy(municipality.id)
    .orderBy(sql`count(distinct ${landlord.id}) desc`, municipality.nameSv);
}

export default async function CoveragePage({ params }: Props) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("coverage");
  const ta = await getTranslations("admin.coverage");
  const rows = await coverageTable();
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[960px] px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{t("pageTitle")}</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">{t("pageIntro")}</p>
        <div className="mt-8 overflow-x-auto rounded-md border border-line bg-surface">
          <table className="w-full min-w-[560px] text-[14.5px]">
            <thead>
              <tr className="border-b border-line text-left text-meta uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-[650]">{ta("colMunicipality")}</th>
                <th className="px-4 py-3 text-right font-[650]">{ta("colKnown")}</th>
                <th className="px-4 py-3 text-right font-[650]">{ta("colMonitored")}</th>
                <th className="px-4 py-3 font-[650]">{ta("colRatio")}</th>
                <th className="px-4 py-3 text-right font-[650]">{ta("colListings")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = r.known ? Math.round((r.monitored / r.known) * 100) : 0;
                return (
                  <tr key={r.m.id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={{ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(r.m, locale) } }} className="font-[600]">
                        {municipalityName(r.m, locale)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{r.known}</td>
                    <td className="px-4 py-2.5 text-right tabular">{r.monitored}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-placeholder" aria-hidden="true">
                          <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-meta text-muted tabular">{t("ratio", { monitored: r.monitored, known: r.known })}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">{r.listings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

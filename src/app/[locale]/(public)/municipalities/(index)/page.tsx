import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { sql, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { countyName, municipalityName, municipalitySlug } from "@/lib/queries/places";

// Rendered at build time and refreshed every five minutes; listing changes from
// the portal and admin clear it immediately through invalidateListingCaches().
export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "municipality" });
  return { title: t("indexTitle"), alternates: alternatesFor(locale, () => "/municipalities") };
}

export default async function MunicipalitiesPage({ params }: Props) {
  const locale = await resolveLocale(params);
  const t = await getTranslations("municipality");
  const { municipality, listing } = schema;
  const rows = await db
    .select({ m: municipality, count: sql<number>`count(${listing.id})::int` })
    .from(municipality)
    .leftJoin(listing, and(eq(listing.municipalityId, municipality.id), eq(listing.status, "active")))
    .groupBy(municipality.id)
    .orderBy(municipality.county, municipality.nameSv);

  const byCounty = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = countyName(r.m, locale);
    byCounty.set(key, [...(byCounty.get(key) ?? []), r]);
  }

  return (
    <>
      <SiteHeader active="municipalities" />
      <main id="main" className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6">
        <h1 className="font-serif text-[36px] leading-tight sm:text-[44px]">{t("indexTitle")}</h1>
        <p className="mt-2 max-w-[60ch] text-ink-2">{t("indexIntro")}</p>
        {[...byCounty.entries()].map(([county, list]) => (
          <section key={county} className="mt-10" aria-labelledby={`c-${county}`}>
            <h2 id={`c-${county}`} className="text-h2">
              {county}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {list.map((r) => (
                <li key={r.m.id} className="list-none">
                  <Link
                    href={{ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(r.m, locale) } }}
                    className="flex min-h-touch items-center justify-between rounded-md border border-line bg-surface px-4 text-[14.5px] font-[600] text-ink hover:border-line-strong hover:no-underline"
                  >
                    <span>{municipalityName(r.m, locale)}</span>
                    <span className="text-meta text-muted tabular">{r.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/lib/locale";
import { alternatesFor } from "@/lib/seo";
import { SiteHeader } from "@/components/site/header";
import { ListingCard } from "@/components/listing/listing-card";
import { Freshness } from "@/components/listing/freshness";
import { Card, Kicker, icons, Callout } from "@/components/ui/misc";
import { listingsForLandlord } from "@/lib/queries/listings";
import { municipalityName, municipalitySlug } from "@/lib/queries/places";
import { initials } from "@/lib/listing-display";

export const revalidate = 300;

type Props = { params: Promise<{ locale: string; slug: string }> };

async function load(slug: string) {
  return db.query.landlord.findFirst({
    where: eq(schema.landlord.slug, slug),
    with: { municipalities: { with: { municipality: { columns: { centroid: false, geom: false } } } }, sources: true },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const l = await load(slug);
  if (!l) return {};
  return { title: l.name, alternates: alternatesFor(locale, () => ({ pathname: "/landlords/[slug]", params: { slug } })) };
}

export default async function LandlordPage({ params }: Props) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const l = await load(slug);
  if (!l) notFound();
  const t = await getTranslations("landlord");
  const tl = await getTranslations("listing");
  const listings = await listingsForLandlord(locale, l.id);
  const intro = locale === "sv" ? l.descriptionSv : l.descriptionEn;
  const queueKey = l.queueType === "none" ? "None" : l.queueType === "queue" ? "Required" : l.queueType === "points" ? "Points" : "Unknown";
  const activeSource = l.sources.find((s) => s.status !== "disabled" && s.kind !== "manual");
  const domain = l.website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const lastChecked = l.sources.reduce<Date | null>((acc, s) => (s.lastSuccessAt && (!acc || s.lastSuccessAt > acc) ? s.lastSuccessAt : acc), null);

  return (
    <>
      <SiteHeader active="landlords" />
      <main id="main">
        <section className="border-b border-line bg-bg">
          <div className="mx-auto flex max-w-[1200px] items-start gap-6 px-4 py-10 sm:px-6">
            <span aria-hidden="true" className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg bg-surface-muted text-[20px] font-[700] text-ink-2">
              {initials(l.name)}
            </span>
            <div className="min-w-0">
              <Kicker>{t("kicker")}</Kicker>
              <h1 className="mt-1 font-serif text-[32px] leading-tight sm:text-[38px]">{l.name}</h1>
              {intro ? <p className="mt-2 max-w-[60ch] text-ink-2">{intro}</p> : null}
              {l.website ? (
                <p className="mt-3">
                  <a href={l.website.startsWith("http") ? l.website : `https://${l.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14.5px] font-[650]">
                    {domain}
                    {icons.external}
                  </a>
                </p>
              ) : null}
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <dd className="text-[28px] font-[700] leading-none tabular">{listings.length}</dd>
                  <dt className="mt-1 text-meta text-muted">{t("statListings")}</dt>
                </div>
                <div>
                  <dd className="text-[28px] font-[700] leading-none tabular">{l.municipalities.length}</dd>
                  <dt className="mt-1 text-meta text-muted">{t("statMunicipalities")}</dt>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1200px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
          <section aria-labelledby="ll-listings" className="min-w-0">
            <h2 id="ll-listings" className="text-h2">
              {t("listingsTitle", { name: l.name })}
            </h2>
            {!l.isMonitored ? (
              <div className="mt-4">
                <Callout tone="info" icon={icons.info}>
                  {t("notMonitored", { name: l.name })}
                </Callout>
              </div>
            ) : listings.length ? (
              <ul className="mt-4 flex flex-col gap-3">
                {listings.map((x) => (
                  <li key={x.id} className="list-none">
                    <ListingCard listing={x} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-2">{t("noListings", { name: l.name })}</p>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <Card as="section" className="p-5">
              <h2 className="text-h3">{t("howTitle")}</h2>
              <p className="mt-2 text-[15px] font-[650]">{tl(`queue${queueKey}Headline`)}</p>
              <p className="mt-1 text-[14px] text-ink-2">{tl(`queue${queueKey}Body`)}</p>
              {l.queueInfoUrl ? (
                <p className="mt-3">
                  <a href={l.queueInfoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-[650]">
                    {t("queueInfoLink")}
                    {icons.external}
                  </a>
                </p>
              ) : null}
            </Card>
            <Card as="section" className="p-5">
              <h2 className="text-h3">{t("municipalitiesTitle")}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {l.municipalities.map((m) => (
                  <li key={m.municipalityId} className="list-none">
                    <Link
                      href={{ pathname: "/municipalities/[slug]", params: { slug: municipalitySlug(m.municipality, locale) } }}
                      className="inline-flex min-h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-[13.5px] font-[600] text-ink hover:bg-bg hover:no-underline"
                    >
                      {municipalityName(m.municipality, locale)}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card as="section" className="p-5">
              <Kicker>{tl("sourceTitle")}</Kicker>
              <p className="mt-2 text-[14px] text-ink-2">
                {activeSource && domain ? t("sourceBody", { domain, interval: activeSource.fetchIntervalMinutes }) : t("sourceBodyDirect")}
              </p>
              <div className="mt-2">
                <Freshness lastCheckedAt={lastChecked} prefix="last" />
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </>
  );
}

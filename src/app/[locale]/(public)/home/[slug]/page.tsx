import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { resolveLocale } from "@/lib/locale";
import { SiteHeader } from "@/components/site/header";
import { Badge, BadgeList } from "@/components/ui/badge";
import { Card, Callout, Kicker, icons } from "@/components/ui/misc";
import { buttonClasses } from "@/components/ui/button";
import { Freshness } from "@/components/listing/freshness";
import { ListingImage } from "@/components/listing/listing-image";
import { SaveButton } from "@/components/listing/save-button";
import { OutboundLink, TrackView } from "@/components/listing/track";
import { ListingCard, getBadgeLabels } from "@/components/listing/listing-card";
import { ListingMap } from "@/components/map/listing-map";
import { getListingBySlug, similarListings } from "@/lib/queries/listings";
import { municipalityName, municipalitySlug } from "@/lib/queries/places";
import { composeBadges, deadlineMessage, deadlineState, initials, rentLabel } from "@/lib/listing-display";
import { formatDateLong, formatDateTime, formatRooms, formatSize } from "@/lib/format";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const l = await getListingBySlug(slug);
  if (!l) return {};
  const place = l.areaName ? `${l.areaName}, ${municipalityName(l.municipality, locale)}` : municipalityName(l.municipality, locale);
  const t = await getTranslations({ locale, namespace: "listing" });
  const rent = rentLabel(locale, l.rentMonthly, t("rentUnknown"));
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const href = (loc: Locale) => site + getPathname({ locale: loc, href: { pathname: "/home/[slug]", params: { slug } } });
  return {
    title: `${l.address}, ${place}`,
    description: `${rent} · ${l.rooms !== null ? formatRooms(locale, l.rooms) : t("roomsUnknown")} · ${l.sizeSqm !== null ? formatSize(locale, l.sizeSqm) : t("sizeUnknown")} · ${l.landlord.name}`,
    alternates: { canonical: href(locale), languages: { sv: href("sv"), en: href("en"), "x-default": href("sv") } },
    robots: l.status === "active" ? undefined : { index: false },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const l = await getListingBySlug(slug);
  if (!l || l.status === "draft") notFound();

  const t = await getTranslations("listing");
  const ta = await getTranslations("actions");
  const td = await getTranslations("deadline");
  const ts = await getTranslations("states");
  const tb = await getTranslations("badges");
  const labels = await getBadgeLabels();
  const gone = l.status !== "active";
  const place = l.areaName ? `${l.areaName}, ${municipalityName(l.municipality, locale)}` : municipalityName(l.municipality, locale);
  const badges = composeBadges({ ...l, applicationDeadline: gone ? null : l.applicationDeadline }, labels, 4);
  const dState = deadlineState(l.applicationDeadline);
  const dMsg = deadlineMessage(locale, l.applicationDeadline);
  const rent = rentLabel(locale, l.rentMonthly, t("rentUnknown"));
  const activeSources = l.sources.filter((s) => s.presentAtLastCheck || gone);
  const multi = activeSources.length > 1;
  const applyUrl = l.applicationUrl ?? activeSources[0]?.sourceUrl ?? null;
  const similar = gone ? await similarListings(locale, { id: l.id, municipalityId: l.municipalityId, rooms: l.rooms }, 2) : [];
  const queueKey = l.queueRequirement === "none" ? "None" : l.queueRequirement === "queue" ? "Required" : l.queueRequirement === "points" ? "Points" : "Unknown";
  const lat = l.lat;
  const lon = l.lon;

  const facts: Array<[string, string]> = [
    [t("monthlyRent"), rent],
    [t("keyRooms"), l.rooms !== null ? formatRooms(locale, l.rooms) : t("roomsUnknown")],
    [t("keySize"), l.sizeSqm !== null ? formatSize(locale, l.sizeSqm) : t("sizeUnknown")],
    [t("floor"), l.floor !== null ? (l.floorsTotal ? t("floorOf", { floor: l.floor, total: l.floorsTotal }) : String(l.floor)) : (await getTranslations("common"))("notStated")],
    [t("keyMoveIn"), l.moveInDate ? formatDateLong(locale, l.moveInDate) : t("moveInUnknown")],
    [t("keyContract"), l.contractType === "sublet" ? t("contractSublet") : t("contractFirst")],
  ];
  if (l.externalId) facts.push([t("externalId"), l.externalId]);

  return (
    <>
      <SiteHeader active="search" />
      <TrackView listingId={l.id} />
      <main id="main" className="bg-bg">
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
          <nav aria-label="" className="text-[13.5px] text-muted">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="text-muted hover:text-ink">
                  {(await getTranslations("navigation"))("home")}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href={{ pathname: "/homes/[place]", params: { place: municipalitySlug(l.municipality, locale) } }} className="text-muted hover:text-ink">
                  {municipalityName(l.municipality, locale)}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-ink">
                {l.address}
              </li>
            </ol>
          </nav>

          {gone ? (
            <Callout tone="warning" icon={icons.removed} title={ts("removedTitle")}>
              <p>{l.status === "unpublished" || l.status === "expired" ? ts("unpublishedBody") : ts("removedBody")}</p>
              <p className="mt-2 text-[13px]">
                <span className="font-[650]">{ts("lastSeen")}:</span> {formatDateTime(locale, l.lastSeenAt)} · <span className="font-[650]">{t("sourceTitle")}:</span> {l.landlord.name}
              </p>
            </Callout>
          ) : null}

          <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_372px]">
            <div className="flex min-w-0 flex-col gap-6">
              <Card as="section" className="p-6 sm:p-8">
                {gone ? (
                  <Badge tone="quiet" icon="warn" className="mb-3">
                    {ts("removedTag")}
                  </Badge>
                ) : null}
                <h1 className="font-serif text-[30px] leading-[1.1] sm:text-h1">{l.address}</h1>
                <p className="mt-2 text-[16px] text-ink-2">{place}</p>
                <BadgeList badges={badges} className="mt-4" />
                <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-6 sm:grid-cols-4">
                  {facts.slice(1, 5).map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-meta text-muted">{k}</dt>
                      <dd className="mt-0.5 text-[16px] font-[650] text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>

              {l.imageUrl || l.images.length ? (
                <Card as="section" className="overflow-hidden">
                  <ListingImage src={l.imageUrl ?? `/api/uploads/${l.images[0]!.storageKey}`} address={l.address} noImage={t("noImage")} className="max-h-[480px] min-h-[200px] w-full" />
                </Card>
              ) : null}

              <Card as="section" className="p-6 sm:p-8" aria-labelledby="about">
                <h2 id="about" className="text-h2">
                  {t("aboutHome")}
                </h2>
                <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {facts.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-hairline py-2 text-[14.5px]">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-[600] text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
                <h3 className="mt-6 text-label font-[650] uppercase tracking-wide text-muted">{t("description")}</h3>
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-2">{l.description ?? t("descriptionMissing")}</p>
              </Card>

              <Card as="section" className="p-6 sm:p-8" aria-labelledby="queue">
                <div className="flex items-start justify-between gap-3">
                  <h2 id="queue" className="text-h2">
                    {t("queueTitle")}
                  </h2>
                  <details className="group relative">
                    <summary className="flex h-touch w-touch cursor-pointer list-none items-center justify-center rounded-full border border-line-strong text-[14px] font-[700] text-muted hover:bg-bg" aria-label={t("queueHelpToggle")}>
                      ?
                    </summary>
                    <div className="absolute right-0 top-12 z-10 w-[min(80vw,360px)] rounded-md border-l-4 border-info bg-info-bg p-4 text-[14px] text-info-text shadow-md">{t("queueHelp")}</div>
                  </details>
                </div>
                <p className="mt-3 text-[16px] font-[650] text-ink">{t(`queue${queueKey}Headline`)}</p>
                <p className="mt-1 text-[14.5px] text-ink-2">{t(`queue${queueKey}Body`)}</p>
                {l.landlord.queueInfoUrl ? (
                  <p className="mt-3">
                    <a href={l.landlord.queueInfoUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-[650]">
                      {(await getTranslations("landlord"))("queueInfoLink")}
                      {icons.external}
                    </a>
                  </p>
                ) : null}
              </Card>

              <Card as="section" className="p-6 sm:p-8" aria-labelledby="location">
                <h2 id="location" className="text-h2">
                  {t("location")}
                </h2>
                <div className="mt-4 h-[260px] overflow-hidden rounded-md border border-line">
                  {lat !== null && lon !== null ? (
                    <ListingMap
                      center={[lon, lat]}
                      zoom={14}
                      markers={[{ id: l.id, lon, lat, label: rent, slug: l.slug, address: l.address, active: true }]}
                      ariaLabel={t("mapOf", { address: l.address })}
                      interactive={false}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-placeholder text-meta text-faint">{place}</div>
                  )}
                </div>
              </Card>

              {gone && similar.length ? (
                <section aria-labelledby="similar">
                  <h2 id="similar" className="text-h2">
                    {ts("similarTitle")}
                  </h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {similar.map((s) => (
                      <li key={s.id} className="list-none">
                        <ListingCard listing={s} variant="compact" />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4">
                    <Link href={{ pathname: "/homes/[place]", params: { place: municipalitySlug(l.municipality, locale) } }} className={buttonClasses("primary")}>
                      {ts("backToSearch")}
                    </Link>
                  </p>
                </section>
              ) : null}
            </div>

            <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
              <Card className="p-6">
                <Kicker>{t("monthlyRent")}</Kicker>
                <p className="mt-1 text-[32px] font-[700] leading-none tabular text-ink">{rent}</p>
                {!gone ? (
                  <div className="mt-4">
                    <Badge tone={dState.tone} icon={dState.tone === "urgent" ? "warn" : dState.tone === "soon" ? "clock" : undefined}>
                      {td(dMsg.key, dMsg.values as never)}
                    </Badge>
                  </div>
                ) : null}
                <div className="mt-5 flex items-center gap-3 border-t border-hairline pt-5">
                  <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-[12px] font-[700] text-ink-2">
                    {initials(l.landlord.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-meta text-muted">{t("landlord")}</p>
                    <Link href={{ pathname: "/landlords/[slug]", params: { slug: l.landlord.slug } }} className="block truncate text-[14.5px] font-[650]">
                      {l.landlord.name}
                    </Link>
                  </div>
                </div>
                {!gone ? (
                  <div className="mt-5 flex flex-col gap-2">
                    {l.applyRoute === "contact" && l.applicationContact ? (
                      <>
                        <p className="text-[13px] text-muted">{t("contactRouteNote")}</p>
                        <a href={l.applicationContact.includes("@") ? `mailto:${l.applicationContact}` : `tel:${l.applicationContact.replace(/\s+/g, "")}`} className={buttonClasses("primary", "lg", "w-full")}>
                          {t("contactRoute")}: {l.applicationContact}
                        </a>
                      </>
                    ) : applyUrl ? (
                      <>
                        <p className="text-[13px] text-muted">{t("leaveNote")}</p>
                        <OutboundLink listingId={l.id} href={applyUrl} className={buttonClasses("primary", "lg", "w-full")}>
                          {ta("applyExternal")}
                          {icons.external}
                        </OutboundLink>
                      </>
                    ) : null}
                    <SaveButton slug={l.slug} size="md" className="w-full" />
                  </div>
                ) : null}
              </Card>

              <Card className="p-6">
                <Kicker>{multi ? t("sources") : t("sourceTitle")}</Kicker>
                {multi ? <p className="mt-2 text-[14px] text-ink-2">{t("multiSource")}</p> : null}
                <ul className="mt-3 flex flex-col divide-y divide-hairline">
                  {(activeSources.length ? activeSources : [null]).map((s, i) => (
                    <li key={s ? s.sourceId : "direct"} className="flex flex-col gap-1 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[14.5px] font-[650] text-ink">{s ? s.source.landlord.name : l.landlord.name}</span>
                        {s?.sourceUrl ? (
                          <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13px] font-[650]">
                            {t("openListing")}
                            {icons.external}
                          </a>
                        ) : null}
                      </div>
                      <Freshness lastCheckedAt={s ? s.lastCheckedAt : l.lastCheckedAt} prefix="last" />
                      {!s && l.publishedDirectly ? <p className="text-meta text-muted">{t("publishedDirectly")}</p> : null}
                      {i === 0 && l.publishedDirectly && s ? null : null}
                    </li>
                  ))}
                </ul>
                {l.publishedDirectly ? (
                  <p className="mt-2">
                    <Badge tone="info">{tb("direct")}</Badge>
                  </p>
                ) : null}
                <p className="mt-3 text-meta leading-relaxed text-muted">{t("sourceDisclaimer")}</p>
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

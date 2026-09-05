import { and, asc, desc, eq, gte, ilike, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { stockholmDate } from "@/lib/format";

const { listing, listingMetricDaily, listingSource, listingRevision, listingImage, source, sourceRun, municipality, landlord, landlordMember, landlordInvitation, user } = schema;

export const PORTAL_STATUSES = ["active", "draft", "expired", "unpublished", "removed"] as const;
export type PortalStatus = (typeof PORTAL_STATUSES)[number];

const dayOffset = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return stockholmDate(d);
};

export async function landlordKpis(landlordId: string) {
  const today = stockholmDate();
  const from30 = dayOffset(29);
  const from60 = dayOffset(59);
  const in7 = dayOffset(-7);
  const [published] = await db
    .select({
      count: sql<number>`count(*) filter (where ${listing.status} = 'active')::int`,
      closing: sql<number>`count(*) filter (where ${listing.status} = 'active' and ${listing.applicationDeadline} between ${today} and ${in7})::int`,
    })
    .from(listing)
    .where(eq(listing.landlordId, landlordId));
  const [cur] = await db
    .select({ views: sql<number>`coalesce(sum(${listingMetricDaily.views}),0)::int`, clicks: sql<number>`coalesce(sum(${listingMetricDaily.outboundClicks}),0)::int` })
    .from(listingMetricDaily)
    .innerJoin(listing, eq(listing.id, listingMetricDaily.listingId))
    .where(and(eq(listing.landlordId, landlordId), gte(listingMetricDaily.day, from30)));
  const [prev] = await db
    .select({ views: sql<number>`coalesce(sum(${listingMetricDaily.views}),0)::int`, clicks: sql<number>`coalesce(sum(${listingMetricDaily.outboundClicks}),0)::int` })
    .from(listingMetricDaily)
    .innerJoin(listing, eq(listing.id, listingMetricDaily.listingId))
    .where(and(eq(listing.landlordId, landlordId), gte(listingMetricDaily.day, from60), lt(listingMetricDaily.day, from30)));
  return { published: published?.count ?? 0, closing: published?.closing ?? 0, views: cur?.views ?? 0, clicks: cur?.clicks ?? 0, prevViews: prev?.views ?? 0, prevClicks: prev?.clicks ?? 0 };
}

export async function landlordStatusCounts(landlordId: string) {
  const rows = await db
    .select({ status: listing.status, count: sql<number>`count(*)::int` })
    .from(listing)
    .where(eq(listing.landlordId, landlordId))
    .groupBy(listing.status);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = r.count;
  return out;
}

export async function landlordListings(landlordId: string, status: PortalStatus, q?: string) {
  const from30 = dayOffset(29);
  const where = [eq(listing.landlordId, landlordId), eq(listing.status, status)];
  if (q) where.push(ilike(listing.address, `%${q}%`));
  return db
    .select({
      id: listing.id,
      slug: listing.slug,
      address: listing.address,
      areaName: listing.areaName,
      rentMonthly: listing.rentMonthly,
      rooms: listing.rooms,
      sizeSqm: listing.sizeSqm,
      status: listing.status,
      applicationDeadline: listing.applicationDeadline,
      publishedDirectly: listing.publishedDirectly,
      views: sql<number>`coalesce((select sum(m.views) from listing_metric_daily m where m.listing_id = ${listing.id} and m.day >= ${from30}),0)::int`,
      clicks: sql<number>`coalesce((select sum(m.outbound_clicks) from listing_metric_daily m where m.listing_id = ${listing.id} and m.day >= ${from30}),0)::int`,
      sourceUrl: sql<string | null>`(select s.url from listing_source ls join source s on s.id = ls.source_id where ls.listing_id = ${listing.id} limit 1)`,
    })
    .from(listing)
    .where(and(...where))
    .orderBy(desc(listing.updatedAt))
    .limit(200);
}

/** Listing detail scoped to a landlord. Geometry read explicitly. */
export async function landlordListing(landlordId: string, id: string) {
  const l = await db.query.listing.findFirst({
    where: and(eq(listing.id, id), eq(listing.landlordId, landlordId)),
    columns: { location: false },
    extras: { lat: sql<number | null>`ST_Y(${listing.location})`.as("lat"), lon: sql<number | null>`ST_X(${listing.location})`.as("lon") },
    with: {
      municipality: { columns: { centroid: false, geom: false } },
      images: { orderBy: (i, { asc }) => [asc(i.position)] },
      sources: { with: { source: true } },
      revisions: { orderBy: (r, { desc }) => [desc(r.changedAt)], limit: 50 },
    },
  });
  return l ?? null;
}

export async function listingMetrics(listingId: string, days = 30) {
  const from = dayOffset(days - 1);
  const rows = await db
    .select({ day: listingMetricDaily.day, views: listingMetricDaily.views, clicks: listingMetricDaily.outboundClicks, saves: listingMetricDaily.saves })
    .from(listingMetricDaily)
    .where(and(eq(listingMetricDaily.listingId, listingId), gte(listingMetricDaily.day, from)))
    .orderBy(asc(listingMetricDaily.day));
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series: Array<{ day: string; views: number; clicks: number; saves: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOffset(i);
    const r = byDay.get(day);
    series.push({ day, views: r?.views ?? 0, clicks: r?.clicks ?? 0, saves: r?.saves ?? 0 });
  }
  return series;
}

export async function landlordMetricsSeries(landlordId: string, days = 30) {
  const from = dayOffset(days - 1);
  const rows = await db
    .select({ day: listingMetricDaily.day, views: sql<number>`sum(${listingMetricDaily.views})::int`, clicks: sql<number>`sum(${listingMetricDaily.outboundClicks})::int` })
    .from(listingMetricDaily)
    .innerJoin(listing, eq(listing.id, listingMetricDaily.listingId))
    .where(and(eq(listing.landlordId, landlordId), gte(listingMetricDaily.day, from)))
    .groupBy(listingMetricDaily.day)
    .orderBy(asc(listingMetricDaily.day));
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series: Array<{ day: string; views: number; clicks: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOffset(i);
    const r = byDay.get(day);
    series.push({ day, views: r?.views ?? 0, clicks: r?.clicks ?? 0 });
  }
  return series;
}

export async function landlordListingTotals(landlordId: string) {
  const from30 = dayOffset(29);
  return db
    .select({
      id: listing.id,
      address: listing.address,
      status: listing.status,
      views: sql<number>`coalesce(sum(${listingMetricDaily.views}),0)::int`,
      clicks: sql<number>`coalesce(sum(${listingMetricDaily.outboundClicks}),0)::int`,
    })
    .from(listing)
    .leftJoin(listingMetricDaily, and(eq(listingMetricDaily.listingId, listing.id), gte(listingMetricDaily.day, from30)))
    .where(and(eq(listing.landlordId, landlordId), inArray(listing.status, ["active", "expired", "unpublished", "removed"])))
    .groupBy(listing.id)
    .orderBy(desc(sql`coalesce(sum(${listingMetricDaily.views}),0)`))
    .limit(100);
}

export async function landlordSources(landlordId: string) {
  return db
    .select({
      s: source,
      listings: sql<number>`(select count(*) from listing_source ls join listing l on l.id = ls.listing_id where ls.source_id = ${source.id} and l.status = 'active')::int`,
    })
    .from(source)
    .where(and(eq(source.landlordId, landlordId), inArray(source.kind, ["feed", "api", "html"])))
    .orderBy(desc(source.createdAt));
}

export async function landlordSource(landlordId: string, id: string) {
  const s = await db.query.source.findFirst({ where: and(eq(source.id, id), eq(source.landlordId, landlordId)) });
  if (!s) return null;
  const runs = await db.select().from(sourceRun).where(eq(sourceRun.sourceId, s.id)).orderBy(desc(sourceRun.startedAt)).limit(20);
  const [count] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listingSource)
    .innerJoin(listing, eq(listing.id, listingSource.listingId))
    .where(and(eq(listingSource.sourceId, s.id), eq(listing.status, "active")));
  return { source: s, runs, activeListings: count?.n ?? 0 };
}

export async function municipalityOptions() {
  return db.select({ id: municipality.id, nameSv: municipality.nameSv, nameEn: municipality.nameEn }).from(municipality).orderBy(asc(municipality.nameSv));
}

export async function landlordAccount(landlordId: string) {
  const ll = await db.query.landlord.findFirst({ where: eq(landlord.id, landlordId) });
  const members = await db
    .select({ userId: landlordMember.userId, role: landlordMember.role, name: user.name, email: user.email, createdAt: landlordMember.createdAt })
    .from(landlordMember)
    .innerJoin(user, eq(user.id, landlordMember.userId))
    .where(eq(landlordMember.landlordId, landlordId))
    .orderBy(asc(landlordMember.createdAt));
  const invites = await db
    .select({ id: landlordInvitation.id, email: landlordInvitation.email, role: landlordInvitation.role, expiresAt: landlordInvitation.expiresAt, inviterName: user.name })
    .from(landlordInvitation)
    .leftJoin(user, eq(user.id, landlordInvitation.invitedBy))
    .where(and(eq(landlordInvitation.landlordId, landlordId), sql`${landlordInvitation.acceptedAt} is null`, sql`${landlordInvitation.expiresAt} > now()`))
    .orderBy(desc(landlordInvitation.createdAt));
  return { landlord: ll!, members, invites };
}

export { listingImage, listingRevision };

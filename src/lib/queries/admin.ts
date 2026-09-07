import { and, desc, eq, gte, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { stockholmDayStart } from "@/lib/format";
import { escapeLike } from "@/lib/like";
import { db, schema } from "@/db";

const { source, sourceRun, landlord, listing, landlordApplication, duplicateCandidate, listingSource, municipality, sourceStatusEnum, listingStatusEnum } = schema;

export async function overviewKpis() {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000);
  const todayStart = stockholmDayStart();
  const [[l], [s], [errs], [pending], [today]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(listing).where(eq(listing.status, "active")),
    db
      .select({
        total: sql<number>`count(*)::int`,
        healthy: sql<number>`count(*) filter (where ${source.status} = 'active')::int`,
        degraded: sql<number>`count(*) filter (where ${source.status} = 'degraded')::int`,
        failed: sql<number>`count(*) filter (where ${source.status} = 'failed')::int`,
        review: sql<number>`count(*) filter (where ${source.status} = 'needs_review')::int`,
      })
      .from(source)
      .where(sql`${source.kind} <> 'manual'`),
    db.select({ n: sql<number>`count(*)::int` }).from(sourceRun).where(and(eq(sourceRun.ok, false), gte(sourceRun.startedAt, dayAgo))),
    db.select({ n: sql<number>`count(*)::int` }).from(landlordApplication).where(eq(landlordApplication.status, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(listing).where(and(eq(listing.status, "active"), gte(listing.firstSeenAt, todayStart))),
  ]);
  return { active: l.n, sources: s, errors24h: errs.n, pending: pending.n, addedToday: today.n };
}

export type SourceRow = Awaited<ReturnType<typeof listSources>>[number];

export async function listSources(filter: { q?: string; status?: string } = {}) {
  const where = [sql`${source.kind} <> 'manual'`];
  if (filter.q) where.push(or(ilike(source.url, `%${escapeLike(filter.q)}%`), ilike(landlord.name, `%${escapeLike(filter.q)}%`))!);
  const status = sourceStatusEnum.enumValues.find((v) => v === filter.status);
  if (status) where.push(eq(source.status, status));
  return db
    .select({
      id: source.id,
      url: source.url,
      kind: source.kind,
      adapter: source.adapter,
      status: source.status,
      lastRunAt: source.lastRunAt,
      lastSuccessAt: source.lastSuccessAt,
      consecutiveFailures: source.consecutiveFailures,
      lastError: source.lastError,
      landlordId: landlord.id,
      landlordName: landlord.name,
      listings: sql<number>`(select count(*) from ${listingSource} ls join ${listing} l on l.id = ls.listing_id where ls.source_id = ${source.id} and l.status = 'active')::int`,
      errors24h: sql<number>`(select count(*) from ${sourceRun} r where r.source_id = ${source.id} and r.ok = false and r.started_at > now() - interval '24 hours')::int`,
    })
    .from(source)
    .innerJoin(landlord, eq(source.landlordId, landlord.id))
    .where(and(...where))
    .orderBy(sql`case ${source.status} when 'failed' then 0 when 'needs_review' then 1 when 'degraded' then 2 when 'pending' then 3 when 'active' then 4 else 5 end`, landlord.name);
}

export async function getSource(id: string) {
  return db.query.source.findFirst({ where: eq(source.id, id), with: { landlord: true, runs: { orderBy: (r, { desc }) => [desc(r.startedAt)], limit: 30 } } });
}

export async function sourceListings(sourceId: string, limit = 50) {
  return db
    .select({ id: listing.id, slug: listing.slug, address: listing.address, status: listing.status, rentMonthly: listing.rentMonthly, lastCheckedAt: listing.lastCheckedAt, present: listingSource.presentAtLastCheck, externalId: listingSource.externalId })
    .from(listingSource)
    .innerJoin(listing, eq(listing.id, listingSource.listingId))
    .where(eq(listingSource.sourceId, sourceId))
    .orderBy(desc(listing.lastSeenAt))
    .limit(limit);
}

/** Alerts for the overview: failed sources, anomalies, duplicates, missing rent, pending applications. */
export async function attentionItems() {
  const failed = await db
    .select({ id: source.id, name: landlord.name, failures: source.consecutiveFailures, error: source.lastError, at: source.lastRunAt, status: source.status })
    .from(source)
    .innerJoin(landlord, eq(source.landlordId, landlord.id))
    .where(inArray(source.status, ["failed", "degraded"]))
    .orderBy(desc(source.consecutiveFailures));
  const anomalies = await db
    .select({ sourceId: source.id, name: landlord.name, found: sourceRun.listingsFound, at: sourceRun.startedAt })
    .from(sourceRun)
    .innerJoin(source, eq(source.id, sourceRun.sourceId))
    .innerJoin(landlord, eq(source.landlordId, landlord.id))
    .where(and(eq(sourceRun.anomaly, true), eq(source.status, "needs_review")))
    .orderBy(desc(sourceRun.startedAt))
    .limit(10);
  const anomaliesWithPrev = await Promise.all(
    anomalies.map(async (a) => {
      const [prev] = await db
        .select({ found: sourceRun.listingsFound })
        .from(sourceRun)
        .where(and(eq(sourceRun.sourceId, a.sourceId), eq(sourceRun.ok, true), eq(sourceRun.anomaly, false), lt(sourceRun.startedAt, a.at)))
        .orderBy(desc(sourceRun.startedAt))
        .limit(1);
      return { ...a, prev: prev?.found ?? null };
    }),
  );
  const dups = await db
    .select({ name: landlord.name, count: sql<number>`count(*)::int`, at: sql<Date>`max(${duplicateCandidate.createdAt})` })
    .from(duplicateCandidate)
    .innerJoin(listing, eq(listing.id, duplicateCandidate.listingAId))
    .innerJoin(landlord, eq(landlord.id, listing.landlordId))
    .where(eq(duplicateCandidate.decision, "pending"))
    .groupBy(landlord.name);
  const missingRent = await db
    .select({ id: landlord.id, name: landlord.name, count: sql<number>`count(*)::int` })
    .from(listing)
    .innerJoin(landlord, eq(landlord.id, listing.landlordId))
    .where(and(eq(listing.status, "active"), sql`${listing.rentMonthly} is null`, eq(listing.publishedDirectly, false)))
    .groupBy(landlord.id, landlord.name)
    .having(sql`count(*) >= 3`);
  return { failed, anomalies: anomaliesWithPrev, dups, missingRent };
}

export async function listLandlords(q?: string) {
  return db
    .select({
      id: landlord.id,
      name: landlord.name,
      slug: landlord.slug,
      orgNumber: landlord.orgNumber,
      type: landlord.type,
      isKnown: landlord.isKnown,
      isMonitored: landlord.isMonitored,
      approvedAt: landlord.approvedAt,
      municipalities: sql<number>`(select count(*) from landlord_municipality lm where lm.landlord_id = ${landlord.id})::int`,
      listings: sql<number>`(select count(*) from ${listing} l where l.landlord_id = ${landlord.id} and l.status = 'active')::int`,
      sources: sql<number>`(select count(*) from ${source} s where s.landlord_id = ${landlord.id})::int`,
    })
    .from(landlord)
    .where(q ? or(ilike(landlord.name, `%${escapeLike(q)}%`), ilike(landlord.orgNumber, `%${escapeLike(q)}%`)) : undefined)
    .orderBy(desc(landlord.isMonitored), landlord.name);
}

export async function getLandlordAdmin(id: string) {
  return db.query.landlord.findFirst({
    where: eq(landlord.id, id),
    with: {
      municipalities: { with: { municipality: { columns: { centroid: false, geom: false } } } },
      sources: true,
      members: { with: { user: true } },
    },
  });
}

export async function listApplications(status: "pending" | "needs_info" | "decided") {
  const where = status === "decided" ? inArray(landlordApplication.status, ["approved", "rejected"]) : eq(landlordApplication.status, status);
  return db.query.landlordApplication.findMany({ where, orderBy: (a, { desc, asc }) => (status === "decided" ? [desc(a.reviewedAt)] : [asc(a.createdAt)]), with: { events: { orderBy: (e, { asc }) => [asc(e.createdAt)] } } });
}

export async function applicationCounts() {
  const rows = await db.select({ status: landlordApplication.status, n: sql<number>`count(*)::int` }).from(landlordApplication).groupBy(landlordApplication.status);
  const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return { pending: get("pending"), needs_info: get("needs_info"), decided: get("approved") + get("rejected") };
}

export async function listListingsAdmin(filter: { q?: string; status?: string; page: number }, pageSize = 50) {
  const where = [];
  if (filter.q) where.push(or(ilike(listing.address, `%${escapeLike(filter.q)}%`), ilike(landlord.name, `%${escapeLike(filter.q)}%`), ilike(listing.externalId, `%${escapeLike(filter.q)}%`))!);
  const status = listingStatusEnum.enumValues.find((v) => v === filter.status);
  if (status) where.push(eq(listing.status, status));
  const w = where.length ? and(...where) : undefined;
  const [rows, [{ count }]] = await Promise.all([
    db
      .select({
        id: listing.id,
        slug: listing.slug,
        address: listing.address,
        status: listing.status,
        rentMonthly: listing.rentMonthly,
        firstSeenAt: listing.firstSeenAt,
        lastCheckedAt: listing.lastCheckedAt,
        publishedDirectly: listing.publishedDirectly,
        landlordName: landlord.name,
        municipality: municipality.nameSv,
        sources: sql<number>`(select count(*) from ${listingSource} ls where ls.listing_id = ${listing.id})::int`,
      })
      .from(listing)
      .innerJoin(landlord, eq(landlord.id, listing.landlordId))
      .innerJoin(municipality, eq(municipality.id, listing.municipalityId))
      .where(w)
      .orderBy(desc(listing.lastCheckedAt))
      .limit(pageSize)
      .offset((filter.page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(listing).innerJoin(landlord, eq(landlord.id, listing.landlordId)).where(w),
  ]);
  return { rows, total: count, pages: Math.max(1, Math.ceil(count / pageSize)) };
}

export async function listDuplicates(decision: "pending" | "decided") {
  const where = decision === "pending" ? eq(duplicateCandidate.decision, "pending") : sql`${duplicateCandidate.decision} <> 'pending'`;
  const rows = await db.query.duplicateCandidate.findMany({
    where,
    orderBy: (d, { desc }) => [desc(d.score), desc(d.createdAt)],
    limit: 50,
  });
  const ids = [...new Set(rows.flatMap((r) => [r.listingAId, r.listingBId]))];
  const listings = ids.length
    ? await db
        .select({ id: listing.id, slug: listing.slug, address: listing.address, rentMonthly: listing.rentMonthly, rooms: listing.rooms, sizeSqm: listing.sizeSqm, landlordName: landlord.name, status: listing.status, sourceDomain: sql<string | null>`(select coalesce(nullif(regexp_replace(ls.source_url, '^https?://([^/]+).*$', '\\1'), ''), null) from ${listingSource} ls where ls.listing_id = ${listing.id} limit 1)` })
        .from(listing)
        .innerJoin(landlord, eq(landlord.id, listing.landlordId))
        .where(inArray(listing.id, ids))
    : [];
  const byId = new Map(listings.map((l) => [l.id, l]));
  return rows.map((r) => ({ ...r, a: byId.get(r.listingAId)!, b: byId.get(r.listingBId)! })).filter((r) => r.a && r.b);
}

export async function listStaff() {
  return db.query.staffUser.findMany({ with: { user: true }, orderBy: (s, { asc }) => [asc(s.createdAt)] });
}

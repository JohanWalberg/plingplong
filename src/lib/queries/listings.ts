import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Locale } from "@/i18n/routing";
import { PAGE_SIZE, RENT_MAX, type SearchFilters } from "@/lib/search-params";
import type { ListingCardData } from "@/components/listing/listing-card";
import { municipalityName } from "./places";
import { stockholmDate } from "@/lib/format";
import { LISTINGS_NS, memoize } from "@/lib/ttl-cache";

const { listing, landlord, municipality, area, source, listingSource, landlordMunicipality } = schema;

export type SearchScope = { municipalityId?: string; areaId?: string; bounds?: [west: number, south: number, east: number, north: number] };

function whereClauses(scope: SearchScope, f: SearchFilters): SQL[] {
  const w: SQL[] = [eq(listing.status, "active")];
  if (scope.municipalityId) w.push(eq(listing.municipalityId, scope.municipalityId));
  if (scope.areaId) w.push(eq(listing.areaId, scope.areaId));
  if (scope.bounds) {
    const [west, south, east, north] = scope.bounds;
    w.push(sql`${listing.location} && ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)`);
  }
  // Null rent always passes a max-rent filter: we never hide a home for a value we do not know.
  if (f.maxRent && f.maxRent < RENT_MAX) w.push(or(isNull(listing.rentMonthly), lte(listing.rentMonthly, f.maxRent))!);
  if (f.rooms.length) {
    const parts: SQL[] = [];
    for (const r of f.rooms) parts.push(r >= 4 ? gte(listing.rooms, 4) : sql`floor(${listing.rooms}) = ${r}`);
    w.push(or(...parts)!);
  }
  if (f.sizeMin) w.push(or(isNull(listing.sizeSqm), gte(listing.sizeSqm, f.sizeMin))!);
  if (f.sizeMax) w.push(or(isNull(listing.sizeSqm), lte(listing.sizeSqm, f.sizeMax))!);
  if (f.queue.length) {
    const values = new Set<string>();
    for (const q of f.queue) {
      if (q === "none") values.add("none");
      if (q === "queue") {
        values.add("queue");
        values.add("points");
      }
      if (q === "unknown") values.add("unknown");
    }
    w.push(inArray(listing.queueRequirement, [...values] as Array<"none" | "queue" | "points" | "unknown">));
  }
  if (f.landlord.length) w.push(inArray(landlord.slug, f.landlord));
  if (f.segment.length) w.push(inArray(listing.segment, f.segment));
  if (f.moveInBefore) w.push(or(isNull(listing.moveInDate), lte(listing.moveInDate, f.moveInBefore))!);
  return w;
}

function orderBy(sort: SearchFilters["sort"]): SQL[] {
  switch (sort) {
    case "rentUp":
      return [sql`${listing.rentMonthly} asc nulls last`, desc(listing.firstSeenAt)];
    case "rentDown":
      return [sql`${listing.rentMonthly} desc nulls last`, desc(listing.firstSeenAt)];
    case "sizeDown":
      return [sql`${listing.sizeSqm} desc nulls last`, desc(listing.firstSeenAt)];
    case "deadline":
      return [sql`${listing.applicationDeadline} asc nulls last`, desc(listing.firstSeenAt)];
    case "checked":
      return [desc(listing.lastCheckedAt), desc(listing.firstSeenAt)];
    default:
      return [desc(listing.firstSeenAt), asc(listing.id)];
  }
}

const cardSelect = (locale: Locale) => ({
  slug: listing.slug,
  address: listing.address,
  areaName: listing.areaName,
  municipalityName: locale === "sv" ? municipality.nameSv : municipality.nameEn,
  rentMonthly: listing.rentMonthly,
  rooms: listing.rooms,
  sizeSqm: listing.sizeSqm,
  imageUrl: listing.imageUrl,
  landlordName: landlord.name,
  landlordSlug: landlord.slug,
  lastCheckedAt: listing.lastCheckedAt,
  applicationDeadline: listing.applicationDeadline,
  queueRequirement: listing.queueRequirement,
  contractType: listing.contractType,
  segment: listing.segment,
  firstSeenAt: listing.firstSeenAt,
  publishedDirectly: listing.publishedDirectly,
  id: listing.id,
  lat: sql<number | null>`ST_Y(${listing.location})`,
  lon: sql<number | null>`ST_X(${listing.location})`,
});

export type SearchResultItem = ListingCardData & { id: string; lat: number | null; lon: number | null };

export async function searchListings(locale: Locale, scope: SearchScope, f: SearchFilters, pageSize = PAGE_SIZE) {
  const where = and(...whereClauses(scope, f));
  const [rows, [{ count }]] = await Promise.all([
    db
      .select(cardSelect(locale))
      .from(listing)
      .innerJoin(landlord, eq(listing.landlordId, landlord.id))
      .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
      .where(where)
      .orderBy(...orderBy(f.sort))
      .limit(pageSize)
      .offset((f.page - 1) * pageSize),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(listing)
      .innerJoin(landlord, eq(listing.landlordId, landlord.id))
      .where(where),
  ]);
  return { items: rows as SearchResultItem[], total: count, pageSize, page: f.page, pages: Math.max(1, Math.ceil(count / pageSize)) };
}

/** All matching listings with coordinates for the map (capped). */
export async function searchListingsForMap(locale: Locale, scope: SearchScope, f: SearchFilters, cap = 500) {
  const where = and(...whereClauses(scope, f), sql`${listing.location} is not null`);
  const rows = await db
    .select(cardSelect(locale))
    .from(listing)
    .innerJoin(landlord, eq(listing.landlordId, landlord.id))
    .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
    .where(where)
    .orderBy(...orderBy(f.sort))
    .limit(cap);
  return rows as SearchResultItem[];
}

/** Landlord facet: active listing counts per landlord inside the scope (ignores the landlord filter itself). */
async function landlordFacetQuery(scope: SearchScope, f: SearchFilters) {
  const where = and(...whereClauses(scope, { ...f, landlord: [] }));
  return db
    .select({ slug: landlord.slug, name: landlord.name, count: sql<number>`count(*)::int` })
    .from(listing)
    .innerJoin(landlord, eq(listing.landlordId, landlord.id))
    .where(where)
    .groupBy(landlord.slug, landlord.name)
    .orderBy(desc(sql`count(*)`), asc(landlord.name))
    .limit(12);
}
const landlordFacetMemo = memoize(LISTINGS_NS, landlordFacetQuery);

/**
 * Memoized for CACHE_TTL_SECONDS; results themselves stay uncached as the brief
 * asks. The page, the sort and the landlord filter are normalised away first:
 * the facet ignores all three, so leaving them in the key gave every sort and
 * every page its own copy of one answer and let filtered traffic evict itself.
 */
export function landlordFacet(scope: SearchScope, f: SearchFilters) {
  return landlordFacetMemo(scope, { ...f, landlord: [], page: 1, sort: "new" });
}

/** Coverage: monitored vs known landlords in a municipality. Never a share of the market. */
async function coverageForQuery(municipalityId: string) {
  const [row] = await db
    .select({
      known: sql<number>`count(*) filter (where ${landlord.isKnown})::int`,
      monitored: sql<number>`count(*) filter (where ${landlord.isKnown} and ${landlord.isMonitored})::int`,
    })
    .from(landlordMunicipality)
    .innerJoin(landlord, eq(landlordMunicipality.landlordId, landlord.id))
    .where(eq(landlordMunicipality.municipalityId, municipalityId));
  return row ?? { known: 0, monitored: 0 };
}
/** Memoized for CACHE_TTL_SECONDS; results themselves stay uncached as the brief asks. */
export const coverageFor = memoize(LISTINGS_NS, coverageForQuery);

/** Sources in a municipality that are currently failing or degraded, for the partial-coverage banner. */
async function failingSourcesForQuery(municipalityId: string) {
  return db
    .select({ landlordName: landlord.name, status: source.status })
    .from(source)
    .innerJoin(landlord, eq(source.landlordId, landlord.id))
    .innerJoin(landlordMunicipality, eq(landlordMunicipality.landlordId, landlord.id))
    .where(and(eq(landlordMunicipality.municipalityId, municipalityId), inArray(source.status, ["failed", "degraded"])))
    .groupBy(landlord.name, source.status);
}
/** Memoized for CACHE_TTL_SECONDS; results themselves stay uncached as the brief asks. */
export const failingSourcesFor = memoize(LISTINGS_NS, failingSourcesForQuery);

/**
 * Site totals for the home page. Counts what we have, never a share of the
 * market: monitored landlords over known landlords is the coverage claim and
 * it lives on the coverage page.
 */
async function siteTotalsQuery() {
  const [homes] = await db.select({ n: sql<number>`count(*)::int` }).from(listing).where(eq(listing.status, "active"));
  const [rest] = await db
    .select({
      landlords: sql<number>`count(distinct ${listing.landlordId})::int`,
      municipalities: sql<number>`count(distinct ${listing.municipalityId})::int`,
    })
    .from(listing)
    .where(eq(listing.status, "active"));
  return { homes: homes?.n ?? 0, landlords: rest?.landlords ?? 0, municipalities: rest?.municipalities ?? 0 };
}
/** Memoized for CACHE_TTL_SECONDS; the home page itself revalidates every five minutes. */
export const siteTotals = memoize(LISTINGS_NS, siteTotalsQuery);

export async function latestListings(locale: Locale, limit = 3) {
  const rows = await db
    .select(cardSelect(locale))
    .from(listing)
    .innerJoin(landlord, eq(listing.landlordId, landlord.id))
    .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
    .where(eq(listing.status, "active"))
    .orderBy(desc(listing.firstSeenAt))
    .limit(limit);
  return rows as SearchResultItem[];
}

export async function listingsForMunicipality(locale: Locale, municipalityId: string, limit = 3) {
  const f = { maxRent: undefined, rooms: [], sizeMin: undefined, sizeMax: undefined, queue: [], landlord: [], segment: [], moveInBefore: undefined, sort: "new", page: 1 } as SearchFilters;
  return searchListings(locale, { municipalityId }, f, limit);
}

export async function listingsForLandlord(locale: Locale, landlordId: string, limit = 50) {
  const rows = await db
    .select(cardSelect(locale))
    .from(listing)
    .innerJoin(landlord, eq(listing.landlordId, landlord.id))
    .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
    .where(and(eq(listing.status, "active"), eq(listing.landlordId, landlordId)))
    .orderBy(desc(listing.firstSeenAt))
    .limit(limit);
  return rows as SearchResultItem[];
}

export async function similarListings(locale: Locale, ref: { id: string; municipalityId: string; rooms: number | null }, limit = 2) {
  const rows = await db
    .select(cardSelect(locale))
    .from(listing)
    .innerJoin(landlord, eq(listing.landlordId, landlord.id))
    .innerJoin(municipality, eq(listing.municipalityId, municipality.id))
    .where(and(eq(listing.status, "active"), eq(listing.municipalityId, ref.municipalityId), ne(listing.id, ref.id)))
    .orderBy(ref.rooms === null ? desc(listing.firstSeenAt) : sql`abs(coalesce(${listing.rooms}, 0) - ${ref.rooms})`, desc(listing.firstSeenAt))
    .limit(limit);
  return rows as SearchResultItem[];
}

/**
 * Listing detail. Geometry columns are excluded from the relational load
 * (PostGIS geometry inside nested JSON cannot be decoded by Drizzle) and the
 * coordinates are selected explicitly instead.
 */
export const getListingBySlug = cache(async (slug: string) => {
  return db.query.listing.findFirst({
    // Drafts were never public. A taken-down listing is not either: unlike an
    // ordinary removal, whose page stays up to say the home is gone, a takedown
    // or an objection means the record must not be readable at all.
    where: and(eq(listing.slug, slug), ne(listing.status, "draft"), isNull(listing.takenDownAt)),
    columns: { location: false },
    extras: {
      lat: sql<number | null>`ST_Y(${listing.location})`.as("lat"),
      lon: sql<number | null>`ST_X(${listing.location})`.as("lon"),
    },
    with: {
      landlord: true,
      municipality: { columns: { centroid: false, geom: false } },
      area: { columns: { centroid: false, geom: false } },
      images: { orderBy: (i, { asc }) => [asc(i.position)] },
      sources: { with: { source: { with: { landlord: true } } } },
    },
  });
});

export async function getListingById(id: string) {
  return db.query.listing.findFirst({
    where: eq(listing.id, id),
    columns: { location: false },
    extras: {
      lat: sql<number | null>`ST_Y(${listing.location})`.as("lat"),
      lon: sql<number | null>`ST_X(${listing.location})`.as("lon"),
    },
    with: {
      landlord: true,
      municipality: { columns: { centroid: false, geom: false } },
      area: { columns: { centroid: false, geom: false } },
      images: { orderBy: (i, { asc }) => [asc(i.position)] },
      sources: { with: { source: { with: { landlord: true } } } },
      revisions: { orderBy: (r, { desc }) => [desc(r.changedAt)] },
    },
  });
}

/** Area pills for a municipality page with active counts. */
export async function areaCounts(municipalityId: string) {
  return db
    .select({ id: area.id, name: area.name, slug: area.slug, count: sql<number>`count(${listing.id})::int` })
    .from(area)
    .leftJoin(listing, and(eq(listing.areaId, area.id), eq(listing.status, "active")))
    .where(eq(area.municipalityId, municipalityId))
    .groupBy(area.id, area.name, area.slug)
    .orderBy(desc(sql`count(${listing.id})`), asc(area.name));
}

/** Landlords with active listings in a municipality. */
export async function landlordCountsFor(municipalityId: string) {
  return db
    .select({ id: landlord.id, name: landlord.name, slug: landlord.slug, isMonitored: landlord.isMonitored, count: sql<number>`count(${listing.id})::int` })
    .from(landlordMunicipality)
    .innerJoin(landlord, eq(landlordMunicipality.landlordId, landlord.id))
    .leftJoin(listing, and(eq(listing.landlordId, landlord.id), eq(listing.municipalityId, municipalityId), eq(listing.status, "active")))
    .where(eq(landlordMunicipality.municipalityId, municipalityId))
    .groupBy(landlord.id, landlord.name, landlord.slug, landlord.isMonitored)
    .orderBy(desc(sql`count(${listing.id})`), asc(landlord.name));
}

export async function municipalityStats(municipalityId: string) {
  const [row] = await db
    .select({
      listings: sql<number>`count(*)::int`,
      medianRent2: sql<number | null>`percentile_cont(0.5) within group (order by ${listing.rentMonthly}) filter (where floor(${listing.rooms}) = 2 and ${listing.rentMonthly} is not null)`,
    })
    .from(listing)
    .where(and(eq(listing.status, "active"), eq(listing.municipalityId, municipalityId)));
  return row;
}

export function placeLabel(m: { nameSv: string; nameEn: string }, locale: Locale) {
  return municipalityName(m, locale);
}

export { stockholmDate };

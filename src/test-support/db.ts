import { eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/db";

const { landlord, listing, listingRevision, listingSource, source, sourceRun, duplicateCandidate, landlordMember, municipality, user } = schema;

/** The seed's Solna row; every integration test places its listings there. */
export async function solnaId(): Promise<string> {
  const m = await db.query.municipality.findFirst({ where: eq(municipality.nameSv, "Solna"), columns: { id: true } });
  if (!m) throw new Error("seed municipality Solna missing: run pnpm db:seed");
  return m.id;
}

/** The seed's lead staff account, for actor columns. */
export async function leadUserId(): Promise<string> {
  const u = await db.query.user.findFirst({ where: eq(user.email, "lead@plingplong.se"), columns: { id: true } });
  if (!u) throw new Error("seed lead user missing: run pnpm db:seed");
  return u.id;
}

let counter = 0;
const tag = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export async function makeLandlord(name = "Testvärden") {
  const [row] = await db
    .insert(landlord)
    .values({ name, slug: `zz-test-${tag()}`, type: "private", queueType: "unknown", approvedAt: new Date(), isKnown: true })
    .returning({ id: landlord.id });
  return row.id;
}

export async function makeSource(landlordId: string, url = `https://feed-${tag()}.test/vacancies.json`) {
  const [row] = await db
    .insert(source)
    .values({ landlordId, kind: "feed", adapter: "generic-json", url, config: { fields: {} }, status: "active", consent: "consented", fetchIntervalMinutes: 60, nextRunAt: new Date() })
    .returning({ id: source.id });
  return row.id;
}

export async function makeListing(landlordId: string, municipalityId: string, values: Partial<typeof listing.$inferInsert> = {}) {
  const [row] = await db
    .insert(listing)
    .values({ slug: `zz-test-${tag()}`, landlordId, municipalityId, address: `Testgatan ${counter}`, rentMonthly: 9000, rooms: 2, sizeSqm: 55, status: "active", ...values })
    .returning({ id: listing.id });
  return row.id;
}

/** Removes everything a test created under these landlords, in dependency order. */
export async function cleanupLandlords(ids: string[]) {
  if (!ids.length) return;
  const ls = await db.select({ id: listing.id }).from(listing).where(inArray(listing.landlordId, ids));
  const listingIds = ls.map((l) => l.id);
  if (listingIds.length) {
    await db.delete(duplicateCandidate).where(or(inArray(duplicateCandidate.listingAId, listingIds), inArray(duplicateCandidate.listingBId, listingIds)));
    await db.delete(listingRevision).where(inArray(listingRevision.listingId, listingIds));
    await db.delete(listingSource).where(inArray(listingSource.listingId, listingIds));
    await db.delete(listing).where(inArray(listing.id, listingIds));
  }
  const ss = await db.select({ id: source.id }).from(source).where(inArray(source.landlordId, ids));
  if (ss.length) {
    await db.delete(sourceRun).where(inArray(sourceRun.sourceId, ss.map((s) => s.id)));
    await db.delete(source).where(inArray(source.landlordId, ids));
  }
  await db.delete(landlordMember).where(inArray(landlordMember.landlordId, ids));
  await db.delete(landlord).where(inArray(landlord.id, ids));
}

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, leadUserId, makeLandlord, makeListing, makeSource, solnaId } from "@/test-support/db";

let staffId = "";
vi.mock("@/lib/access", () => ({
  requireStaff: async () => ({ userId: staffId, email: "lead@plingplong.se", name: "Lead", locale: "sv", sessionCreatedAt: new Date(), role: "lead" }),
}));
vi.mock("@/i18n/navigation", () => ({
  redirect: (to: unknown) => {
    throw new Error(`REDIRECT ${JSON.stringify(to)}`);
  },
  getPathname: () => "/",
}));
vi.mock("@/lib/jobs", () => ({ enqueueSourceSync: async () => {}, enqueueAllSyncs: async () => 0 }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/listing-cache", () => ({ invalidateListingCaches: () => {} }));

const { mergeListings } = await import("./sync");
const { decideDuplicate } = await import("@/actions/admin");
const { listing, listingSource, duplicateCandidate } = schema;

const landlords: string[] = [];
let muni: string;
beforeAll(async () => {
  muni = await solnaId();
  staffId = await leadUserId();
});
afterAll(() => cleanupLandlords(landlords));

async function pair() {
  const lid = await makeLandlord("Dubblett AB");
  landlords.push(lid);
  const s1 = await makeSource(lid);
  const s2 = await makeSource(lid);
  const a = await makeListing(lid, muni, { address: "Råsundavägen 1" });
  const b = await makeListing(lid, muni, { address: "Rasundavagen 1" });
  await db.insert(listingSource).values([
    { listingId: a, sourceId: s1, externalId: "a1" },
    { listingId: b, sourceId: s2, externalId: "b1" },
  ]);
  const [x, y] = a < b ? [a, b] : [b, a];
  const [c] = await db.insert(duplicateCandidate).values({ listingAId: x, listingBId: y, score: "0.900", features: {} }).returning({ id: duplicateCandidate.id });
  return { a, b, s1, s2, candidate: c.id };
}

describe("mergeListings", () => {
  it("moves the loser's sources, marks it removed and closes pending candidates", async () => {
    const { a, b, s1, s2, candidate } = await pair();
    await mergeListings(a, b, null);
    const links = await db.select({ sourceId: listingSource.sourceId }).from(listingSource).where(eq(listingSource.listingId, a));
    expect(new Set(links.map((l) => l.sourceId))).toEqual(new Set([s1, s2]));
    expect(await db.select().from(listingSource).where(eq(listingSource.listingId, b))).toHaveLength(0);
    expect(await db.query.listing.findFirst({ where: eq(listing.id, b), columns: { status: true, mergedIntoId: true } })).toEqual({ status: "removed", mergedIntoId: a });
    expect((await db.query.duplicateCandidate.findFirst({ where: eq(duplicateCandidate.id, candidate) }))?.decision).toBe("merged");
  });
});

describe("decideDuplicate", () => {
  it("merges once; a repeat decision reports no change", async () => {
    const { a, b, candidate } = await pair();
    // The candidate stores the smaller id as A and the staff merge keeps A.
    const [survivor, loser] = a < b ? [a, b] : [b, a];
    expect(await decideDuplicate("sv", candidate, "merged")).toEqual({ ok: true });
    const survivorLinks = await db.select().from(listingSource).where(eq(listingSource.listingId, survivor));
    expect(survivorLinks).toHaveLength(2);
    expect((await db.query.listing.findFirst({ where: eq(listing.id, loser), columns: { status: true } }))?.status).toBe("removed");
    const c = await db.query.duplicateCandidate.findFirst({ where: eq(duplicateCandidate.id, candidate) });
    expect(c).toMatchObject({ decision: "merged", decidedBy: staffId });
    expect(await decideDuplicate("sv", candidate, "merged")).toEqual({ ok: false, error: "noChange" });
    expect(await decideDuplicate("sv", candidate, "ignored")).toEqual({ ok: false, error: "noChange" });
  });

  it("not_duplicate closes the candidate without touching the listings", async () => {
    const { a, b, candidate } = await pair();
    expect(await decideDuplicate("sv", candidate, "not_duplicate")).toEqual({ ok: true });
    for (const id of [a, b]) expect((await db.query.listing.findFirst({ where: eq(listing.id, id), columns: { status: true } }))?.status).toBe("active");
  });
});

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, leadUserId, makeLandlord, makeListing, makeSource, solnaId } from "@/test-support/db";

vi.mock("@/lib/email", () => ({ sendEmail: async () => {} }));

const { withdrawSources } = await import("./sync");
const { listing, listingRevision, listingSource } = schema;

const landlords: string[] = [];
let muni: string;
let actor: string;

beforeAll(async () => {
  muni = await solnaId();
  actor = await leadUserId();
});
afterAll(() => cleanupLandlords(landlords));

async function landlordWithSources(count: number) {
  const id = await makeLandlord("Invändning AB");
  landlords.push(id);
  const sources = [];
  for (let i = 0; i < count; i++) sources.push(await makeSource(id));
  return { landlordId: id, sources };
}

const statusOf = async (id: string) => (await db.query.listing.findFirst({ where: eq(listing.id, id), columns: { status: true } }))?.status;

describe("withdrawSources", () => {
  it("removes a listing that only the objecting source carried, with a revision", async () => {
    const { landlordId, sources } = await landlordWithSources(1);
    const l = await makeListing(landlordId, muni);
    await db.insert(listingSource).values({ listingId: l, sourceId: sources[0], externalId: "w1" });

    expect(await withdrawSources(sources, actor)).toBe(1);
    expect(await statusOf(l)).toBe("removed");
    const link = await db.query.listingSource.findFirst({ where: and(eq(listingSource.listingId, l), eq(listingSource.sourceId, sources[0])) });
    expect(link?.presentAtLastCheck).toBe(false);
    const revs = await db.select({ oldValue: listingRevision.oldValue, newValue: listingRevision.newValue, origin: listingRevision.origin }).from(listingRevision).where(eq(listingRevision.listingId, l));
    expect(revs).toContainEqual({ oldValue: "active", newValue: "removed", origin: "admin" });
  });

  it("keeps a listing another source still carries", async () => {
    const { landlordId, sources } = await landlordWithSources(2);
    const shared = await makeListing(landlordId, muni);
    const only = await makeListing(landlordId, muni);
    await db.insert(listingSource).values([
      { listingId: shared, sourceId: sources[0], externalId: "w2" },
      { listingId: shared, sourceId: sources[1], externalId: "w3" },
      { listingId: only, sourceId: sources[0], externalId: "w4" },
    ]);

    expect(await withdrawSources([sources[0]], null, db)).toBe(1);
    expect(await statusOf(shared)).toBe("active");
    expect(await statusOf(only)).toBe("removed");
  });

  it("is idempotent and leaves listings the landlord published in the portal alone", async () => {
    const { landlordId, sources } = await landlordWithSources(1);
    const crawled = await makeListing(landlordId, muni);
    const direct = await makeListing(landlordId, muni, { publishedDirectly: true });
    await db.insert(listingSource).values({ listingId: crawled, sourceId: sources[0], externalId: "w5" });

    expect(await withdrawSources(sources, null)).toBe(1);
    expect(await withdrawSources(sources, null)).toBe(0);
    expect(await statusOf(direct)).toBe("active");
  });

  it("does nothing for a source with no listings", async () => {
    const { sources } = await landlordWithSources(1);
    expect(await withdrawSources(sources, null)).toBe(0);
  });
});

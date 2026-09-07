import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeListing, solnaId } from "@/test-support/db";
import { getListingBySlug } from "./listings";

/**
 * A removal and a takedown share a status but not a meaning. The page for a
 * home the feed stopped listing stays up and says so; the page for a home we
 * were told to stop showing must not resolve at all.
 */
const { listing } = schema;
const landlords: string[] = [];
let muni: string;
let landlordId: string;

beforeAll(async () => {
  muni = await solnaId();
  landlordId = await makeLandlord("Nedtagning AB");
  landlords.push(landlordId);
});
afterAll(() => cleanupLandlords(landlords));

const slugOf = async (id: string) => (await db.query.listing.findFirst({ where: eq(listing.id, id), columns: { slug: true } }))!.slug;

describe("getListingBySlug", () => {
  it("still serves a home that is merely gone at the source, so old links explain themselves", async () => {
    const id = await makeListing(landlordId, muni, { status: "removed", removedAt: new Date() });
    const found = await getListingBySlug(await slugOf(id));
    expect(found?.id).toBe(id);
  });

  it("serves nothing once the home is taken down", async () => {
    const id = await makeListing(landlordId, muni, { status: "removed", removedAt: new Date(), takenDownAt: new Date() });
    expect(await getListingBySlug(await slugOf(id))).toBeUndefined();
  });

  it("serves nothing for a taken-down home that is still marked active", async () => {
    // Belt and braces: the exclusion must not depend on the status agreeing.
    const id = await makeListing(landlordId, muni, { status: "active", takenDownAt: new Date() });
    expect(await getListingBySlug(await slugOf(id))).toBeUndefined();
  });

  it("never served a draft", async () => {
    const id = await makeListing(landlordId, muni, { status: "draft" });
    expect(await getListingBySlug(await slugOf(id))).toBeUndefined();
  });
});

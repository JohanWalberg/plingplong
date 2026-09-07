import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, leadUserId, makeLandlord, makeListing, solnaId } from "@/test-support/db";

let ownerOf = "";
let userId = "";
vi.mock("@/lib/access", () => ({
  requireLandlord: async () => ({ userId, email: "owner@test", name: "Owner", locale: "sv", sessionCreatedAt: new Date(), landlordId: ownerOf, landlordName: "A", landlordSlug: "a", role: "owner" }),
}));
vi.mock("@/i18n/navigation", () => ({
  redirect: (to: unknown) => {
    throw new Error(`REDIRECT ${JSON.stringify(to)}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/listing-cache", () => ({ invalidateListingCaches: () => {} }));

const { unpublishListing, saveListing } = await import("./portal-listings");
const { listing } = schema;

const landlords: string[] = [];
let muni: string;
let landlordA: string;
let landlordB: string;
let listingOfB: string;

beforeAll(async () => {
  muni = await solnaId();
  userId = await leadUserId();
  landlordA = await makeLandlord("A AB");
  landlordB = await makeLandlord("B AB");
  landlords.push(landlordA, landlordB);
  ownerOf = landlordA;
  listingOfB = await makeListing(landlordB, muni, { publishedDirectly: true, status: "active", publishedAt: new Date() });
});
afterAll(() => cleanupLandlords(landlords));

describe("landlord scoping", () => {
  it("an owner of A calling unpublishListing on B's listing changes nothing", async () => {
    await expect(unpublishListing("sv", listingOfB)).rejects.toThrow(/REDIRECT/);
    expect((await db.query.listing.findFirst({ where: eq(listing.id, listingOfB), columns: { status: true } }))?.status).toBe("active");
  });
});

describe("saveListing", () => {
  it("writes nothing when required fields are missing", async () => {
    const before = await db.select({ id: listing.id }).from(listing).where(eq(listing.landlordId, landlordA));
    const res = await saveListing("sv", "publish", null, null, new FormData());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(Object.keys(res.errors).length).toBeGreaterThan(0);
    const after = await db.select({ id: listing.id }).from(listing).where(eq(listing.landlordId, landlordA));
    expect(after).toHaveLength(before.length);
  });

  it("writes nothing when a photo is not an image", async () => {
    const fd = new FormData();
    fd.set("address", "Testvägen 1");
    fd.set("municipalityId", muni);
    fd.set("rentMonthly", "9000");
    fd.set("rooms", "2");
    fd.set("sizeSqm", "50");
    fd.set("applicationDeadline", "2030-01-01");
    fd.append("images", new File([new Uint8Array([1, 2, 3, 4])], "x.jpg", { type: "image/jpeg" }));
    const before = await db.select({ id: listing.id }).from(listing).where(eq(listing.landlordId, landlordA));
    const res = await saveListing("sv", "draft", null, null, fd);
    expect(res.ok).toBe(false);
    const after = await db.select({ id: listing.id }).from(listing).where(eq(listing.landlordId, landlordA));
    expect(after).toHaveLength(before.length);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeListing, makeSource, solnaId } from "@/test-support/db";
import { listLandlords, listSources } from "./admin";
import { landlordListings, landlordSources } from "./portal";

/**
 * These counts come from correlated subqueries. An unqualified outer reference
 * inside one silently matches nothing and reports zero rather than failing, so
 * the numbers have to be checked against known data.
 */
const landlords: string[] = [];
let landlordId: string;
let sourceId: string;
let muni: string;

beforeAll(async () => {
  muni = await solnaId();
  landlordId = await makeLandlord("Räknetest AB");
  landlords.push(landlordId);
  sourceId = await makeSource(landlordId);
  const active = [await makeListing(landlordId, muni), await makeListing(landlordId, muni)];
  const removed = await makeListing(landlordId, muni, { status: "removed" });
  await db.insert(schema.listingSource).values([...active, removed].map((id, i) => ({ listingId: id, sourceId, externalId: `count-${i}` })));
});
afterAll(() => cleanupLandlords(landlords));

describe("counts from correlated subqueries", () => {
  it("the portal counts a source's active listings", async () => {
    const rows = await landlordSources(landlordId);
    expect(rows.map((r) => r.listings)).toEqual([2]);
  });

  it("the portal shows which source a listing came from", async () => {
    const rows = await landlordListings(landlordId, "active");
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.sourceUrl).toMatch(/^https:\/\/feed-/);
  });

  it("admin counts a landlord's active listings and sources", async () => {
    const row = (await listLandlords("Räknetest")).find((l) => l.id === landlordId);
    expect(row).toMatchObject({ listings: 2, sources: 1 });
  });

  it("admin counts a source's active listings", async () => {
    const row = (await listSources()).find((s) => s.id === sourceId);
    expect(row?.listings).toBe(2);
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeListing, solnaId } from "@/test-support/db";

/**
 * Every coordinate used to be written without an SRID under a column that
 * claimed 4326. Bounding-box operators ignore SRID, so search looked fine while
 * any geography cast was quietly wrong. These check both halves: the column
 * constrains the SRID, and what the driver writes carries it.
 */
const landlords: string[] = [];
let listingId: string;

beforeAll(async () => {
  const landlordId = await makeLandlord("SRID-test AB");
  landlords.push(landlordId);
  listingId = await makeListing(landlordId, await solnaId(), { location: { x: 18.0, y: 59.36 } });
});
afterAll(() => cleanupLandlords(landlords));

describe("coordinates are stored as WGS 84", () => {
  it("declares SRID 4326 on every point column", async () => {
    const rows = await db.execute<{ f_table_name: string; srid: number }>(
      sql`select f_table_name, srid from geometry_columns where type = 'POINT' order by f_table_name`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect([r.f_table_name, r.srid]).toEqual([r.f_table_name, 4326]);
  });

  it("writes the SRID with the point, not just in the column definition", async () => {
    const [row] = await db.execute<{ srid: number; x: number; y: number }>(
      sql`select ST_SRID(location) as srid, ST_X(location) as x, ST_Y(location) as y from listing where id = ${listingId}`,
    );
    expect(row.srid).toBe(4326);
    expect([row.x, row.y]).toEqual([18.0, 59.36]);
  });

  it("reads a point back as the coordinates it was given", async () => {
    const row = await db.query.listing.findFirst({ where: (l, { eq }) => eq(l.id, listingId), columns: { location: true } });
    expect(row?.location).toEqual({ x: 18.0, y: 59.36 });
  });

  it("measures distance in metres, which is what the SRID buys", async () => {
    // Solna to roughly one degree of longitude east, at this latitude ~57 km.
    const [row] = await db.execute<{ m: number }>(
      sql`select ST_Distance(location::geography, ST_SetSRID(ST_MakePoint(19.0, 59.36), 4326)::geography) as m from listing where id = ${listingId}`,
    );
    expect(Number(row.m)).toBeGreaterThan(50_000);
    expect(Number(row.m)).toBeLessThan(60_000);
  });
});

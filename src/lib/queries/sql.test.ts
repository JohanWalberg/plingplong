import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import { outer } from "./sql";

// SQL generation only: the query builder needs no connection, so this stays a unit test.
const db = new QueryBuilder();

const { listing, source, landlord } = schema;

describe("outer", () => {
  it("qualifies the reference in a single-table select, where Drizzle would emit a bare name", () => {
    const bare = db.select({ n: sql`(select count(*) from listing_source ls where ls.source_id = ${source.id})` }).from(source).toSQL().sql;
    const qualified = db.select({ n: sql`(select count(*) from listing_source ls where ls.source_id = ${outer(source.id)})` }).from(source).toSQL().sql;
    expect(bare).toContain(`ls.source_id = "id"`);
    expect(qualified).toContain(`ls.source_id = "source"."id"`);
  });

  it("renders the same reference Drizzle uses when the select does join", () => {
    const joined = db
      .select({ n: sql`(select count(*) from listing_source ls where ls.listing_id = ${listing.id})` })
      .from(listing)
      .innerJoin(landlord, eq(landlord.id, listing.landlordId))
      .toSQL().sql;
    expect(joined).toContain(`ls.listing_id = "listing"."id"`);
    expect(db.select({ n: sql`${outer(listing.id)}` }).from(listing).toSQL().sql).toContain(`"listing"."id"`);
  });

  it("uses the declared column name, not the property name", () => {
    expect(db.select({ n: sql`${outer(listing.landlordId)}` }).from(listing).toSQL().sql).toContain(`"listing"."landlord_id"`);
    expect(db.select({ n: sql`${outer(schema.listingSource.sourceId)}` }).from(listing).toSQL().sql).toContain(`"listing_source"."source_id"`);
  });
});

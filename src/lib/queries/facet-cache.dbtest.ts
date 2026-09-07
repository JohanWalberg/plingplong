import { beforeEach, describe, expect, it } from "vitest";
import { parseSearchParams } from "@/lib/search-params-parse";

// The memo reads the TTL once at module load and is off at zero, which is what
// the test environment sets, so turn it on before importing the queries.
process.env.CACHE_TTL_SECONDS = "60";
const { landlordFacet } = await import("./listings");
const { LISTINGS_NS } = await import("@/lib/ttl-cache");

/** The store the memo writes into, so we can count entries rather than guess. */
const entries = () => (globalThis as unknown as { __hyrabostadCache: Map<string, Map<string, unknown>> }).__hyrabostadCache.get(LISTINGS_NS);
const facetKeys = () => [...(entries()?.keys() ?? [])].filter((k) => k.includes("landlordFacetQuery"));

beforeEach(() => entries()?.clear());

/**
 * The landlord facet ignores the landlord filter, the page and the sort. If any
 * of them reach the cache key, one answer is stored once per sort per page and
 * filtered traffic evicts itself out of a bounded cache.
 */
describe("landlordFacet caching", () => {
  it("stores one entry however the page, sort and landlord filter vary", async () => {
    await landlordFacet({}, parseSearchParams({ maxRent: "12000" }));
    await landlordFacet({}, parseSearchParams({ maxRent: "12000", page: "4" }));
    await landlordFacet({}, parseSearchParams({ maxRent: "12000", sort: "rentUp" }));
    await landlordFacet({}, parseSearchParams({ maxRent: "12000", landlord: "signalisten" }));
    expect(facetKeys()).toHaveLength(1);
  });

  it("still separates entries when a filter the facet does use differs", async () => {
    await landlordFacet({}, parseSearchParams({ maxRent: "12000" }));
    await landlordFacet({}, parseSearchParams({ maxRent: "6000" }));
    expect(facetKeys()).toHaveLength(2);
  });

  it("gives the same counts whatever the page and sort, and honours the filters it does read", async () => {
    const a = await landlordFacet({}, parseSearchParams({ maxRent: "12000" }));
    const b = await landlordFacet({}, parseSearchParams({ maxRent: "12000", page: "4", sort: "rentUp", landlord: "signalisten" }));
    expect(b).toEqual(a);
    const total = (rows: Array<{ count: number }>) => rows.reduce((n, r) => n + r.count, 0);
    expect(total(await landlordFacet({}, parseSearchParams({ maxRent: "6000" })))).toBeLessThan(total(await landlordFacet({}, parseSearchParams({}))));
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, schema } from "@/db";
import { cleanupLandlords, makeLandlord, makeListing, solnaId } from "@/test-support/db";
import { searchListings, searchListingsForMap, type SearchScope } from "./listings";
import type { SearchFilters } from "@/lib/search-params";

/**
 * The predicate every seeker hits. Parsing the URL into filters is covered in
 * search-params-parse.test.ts; this covers the half that decides which rows come
 * back, which nothing exercised before — a whole listing could have been hidden
 * or wrongly shown without a test noticing.
 *
 * Fixtures live under one throwaway landlord and every query is scoped to it, so
 * the seed data cannot move the counts.
 */
const landlords: string[] = [];
let landlordId: string;
let landlordSlug: string;
let muni: string;
const id: Record<string, string> = {};

const NO_FILTERS: SearchFilters = { rooms: [], queue: [], landlord: [], segment: [], sort: "new", page: 1 };
const filters = (f: Partial<SearchFilters> = {}): SearchFilters => ({ ...NO_FILTERS, ...f, landlord: [landlordSlug] });

/** Slugs of the homes a search returns, so assertions read as sets of fixtures. */
async function found(f: Partial<SearchFilters> = {}, scope: SearchScope = {}) {
  const { items } = await searchListings("sv", scope, filters(f), 100);
  return items.map((i) => i.slug).sort();
}
const slugOf = (...keys: string[]) => keys.map((k) => id[k]).sort();

beforeAll(async () => {
  muni = await solnaId();
  landlordId = await makeLandlord("Sökfilter AB");
  landlords.push(landlordId);
  const l = await db.query.landlord.findFirst({ where: (t, { eq }) => eq(t.id, landlordId), columns: { slug: true } });
  landlordSlug = l!.slug;

  const make = async (key: string, values: Parameters<typeof makeListing>[2]) => {
    const listingId = await makeListing(landlordId, muni, values);
    const row = await db.query.listing.findFirst({ where: (t, { eq }) => eq(t.id, listingId), columns: { slug: true } });
    id[key] = row!.slug;
    return listingId;
  };

  // A spread of homes, each differing in one dimension from the others.
  await make("cheapSmall", { rentMonthly: 5000, rooms: 1, sizeSqm: 25, queueRequirement: "none", segment: "student", location: { x: 18.0, y: 59.36 } });
  await make("midTwo", { rentMonthly: 10000, rooms: 2, sizeSqm: 55, queueRequirement: "queue", applicationDeadline: "2030-01-15", location: { x: 18.01, y: 59.37 } });
  await make("pricyFour", { rentMonthly: 20000, rooms: 4, sizeSqm: 110, queueRequirement: "points", segment: "senior", applicationDeadline: "2030-01-05" });
  await make("bigFive", { rentMonthly: 18000, rooms: 5, sizeSqm: 140, queueRequirement: "unknown", moveInDate: "2030-06-01" });
  await make("unknownRent", { rentMonthly: null, rooms: 2, sizeSqm: null, queueRequirement: "none" });
  // Not visible to anyone searching.
  await make("draft", { status: "draft", rentMonthly: 6000, rooms: 1 });
  await make("removed", { status: "removed", removedAt: new Date(), rentMonthly: 6000, rooms: 1 });
  await make("expired", { status: "expired", rentMonthly: 6000, rooms: 1 });
  await make("takenDownButActive", { status: "active", takenDownAt: new Date(), rentMonthly: 6000, rooms: 1 });
});
afterAll(() => cleanupLandlords(landlords));

const LIVE = ["cheapSmall", "midTwo", "pricyFour", "bigFive", "unknownRent"];

describe("what search shows at all", () => {
  it("shows only active homes", async () => {
    expect(await found()).toEqual(slugOf(...LIVE));
  });

  it("never shows a home staff took down, even if its status says active", async () => {
    // The crawler could put a taken-down home back to active; its own page 404s,
    // so listing it would advertise a home nobody can open.
    expect(await found()).not.toContain(id.takenDownButActive);
  });

  it("counts the same homes it lists", async () => {
    const { total, items } = await searchListings("sv", {}, filters(), 100);
    expect(total).toBe(items.length);
    expect(total).toBe(LIVE.length);
  });
});

describe("rent", () => {
  it("keeps homes at or under the maximum", async () => {
    expect(await found({ maxRent: 10000 })).toEqual(slugOf("cheapSmall", "midTwo", "unknownRent"));
  });

  it("keeps a home whose rent is unknown rather than hiding it for a missing value", async () => {
    expect(await found({ maxRent: 5000 })).toEqual(slugOf("cheapSmall", "unknownRent"));
  });

  it("treats the top of the range as no limit", async () => {
    expect(await found({ maxRent: 25000 })).toEqual(slugOf(...LIVE));
  });
});

describe("rooms", () => {
  it("matches an exact room count", async () => {
    expect(await found({ rooms: [2] })).toEqual(slugOf("midTwo", "unknownRent"));
  });

  it("treats four as four or more, so a five-room home is not lost", async () => {
    expect(await found({ rooms: [4] })).toEqual(slugOf("pricyFour", "bigFive"));
  });

  it("combines several room counts as alternatives", async () => {
    expect(await found({ rooms: [1, 2] })).toEqual(slugOf("cheapSmall", "midTwo", "unknownRent"));
  });
});

describe("size", () => {
  it("applies a minimum", async () => {
    expect(await found({ sizeMin: 100 })).toEqual(slugOf("pricyFour", "bigFive", "unknownRent"));
  });

  it("applies a maximum", async () => {
    expect(await found({ sizeMax: 55 })).toEqual(slugOf("cheapSmall", "midTwo", "unknownRent"));
  });

  it("applies both ends together", async () => {
    expect(await found({ sizeMin: 50, sizeMax: 120 })).toEqual(slugOf("midTwo", "pricyFour", "unknownRent"));
  });
});

describe("queue requirement", () => {
  it("finds homes with no queue", async () => {
    expect(await found({ queue: ["none"] })).toEqual(slugOf("cheapSmall", "unknownRent"));
  });

  it("counts a points system as a queue, because it is one to the seeker", async () => {
    expect(await found({ queue: ["queue"] })).toEqual(slugOf("midTwo", "pricyFour"));
  });

  it("keeps 'unknown' separate from 'none'", async () => {
    expect(await found({ queue: ["unknown"] })).toEqual(slugOf("bigFive"));
  });
});

describe("segment and move-in", () => {
  it("filters by segment", async () => {
    expect(await found({ segment: ["student"] })).toEqual(slugOf("cheapSmall"));
  });

  it("keeps a home with no move-in date rather than hiding it", async () => {
    expect(await found({ moveInBefore: "2030-01-01" })).toEqual(slugOf("cheapSmall", "midTwo", "pricyFour", "unknownRent"));
  });

  it("includes a move-in date on or before the cutoff", async () => {
    expect(await found({ moveInBefore: "2030-06-01" })).toEqual(slugOf(...LIVE));
  });
});

describe("filters combine", () => {
  it("applies every filter at once", async () => {
    expect(await found({ maxRent: 12000, rooms: [2], sizeMin: 50 })).toEqual(slugOf("midTwo", "unknownRent"));
  });
});

describe("sorting", () => {
  const order = async (sort: SearchFilters["sort"]) => (await searchListings("sv", {}, filters({ sort }), 100)).items.map((i) => i.slug);

  it("sorts rent ascending with unknown rent last", async () => {
    const got = await order("rentUp");
    expect(got.slice(0, 4)).toEqual([id.cheapSmall, id.midTwo, id.bigFive, id.pricyFour]);
    expect(got.at(-1)).toBe(id.unknownRent);
  });

  it("sorts rent descending with unknown rent last", async () => {
    const got = await order("rentDown");
    expect(got.slice(0, 4)).toEqual([id.pricyFour, id.bigFive, id.midTwo, id.cheapSmall]);
    expect(got.at(-1)).toBe(id.unknownRent);
  });

  it("sorts size descending with unknown size last", async () => {
    const got = await order("sizeDown");
    expect(got.slice(0, 4)).toEqual([id.bigFive, id.pricyFour, id.midTwo, id.cheapSmall]);
    expect(got.at(-1)).toBe(id.unknownRent);
  });

  it("sorts by deadline soonest first, with no deadline last", async () => {
    const got = await order("deadline");
    expect(got.slice(0, 2)).toEqual([id.pricyFour, id.midTwo]);
  });
});

describe("paging", () => {
  it("splits the results and reports the page count", async () => {
    const first = await searchListings("sv", {}, filters({ sort: "rentUp" }), 2);
    expect(first.items).toHaveLength(2);
    expect([first.total, first.pages, first.page]).toEqual([5, 3, 1]);
    const second = await searchListings("sv", {}, filters({ sort: "rentUp", page: 2 }), 2);
    expect(second.items.map((i) => i.slug)).toEqual([id.bigFive, id.pricyFour]);
  });
});

describe("scope", () => {
  it("limits to a municipality", async () => {
    expect(await found({}, { municipalityId: muni })).toEqual(slugOf(...LIVE));
    expect(await found({}, { municipalityId: "no-such-municipality" })).toEqual([]);
  });

  it("limits to a bounding box, and only homes that have coordinates", async () => {
    const inBox = await searchListingsForMap("sv", { bounds: [17.9, 59.3, 18.1, 59.4] }, filters());
    expect(inBox.items.map((i) => i.slug).sort()).toEqual(slugOf("cheapSmall", "midTwo"));
  });

  it("leaves out homes outside the box", async () => {
    const elsewhere = await searchListingsForMap("sv", { bounds: [11.9, 57.6, 12.1, 57.8] }, filters());
    expect(elsewhere.items).toEqual([]);
  });

  it("reports when it stopped at the cap", async () => {
    // Two of the fixtures carry coordinates, and the map only shows those.
    const capped = await searchListingsForMap("sv", {}, filters(), 1);
    expect([capped.items.length, capped.capped]).toEqual([1, true]);
    const whole = await searchListingsForMap("sv", {}, filters(), 50);
    expect([whole.items.length, whole.capped]).toEqual([2, false]);
  });
});

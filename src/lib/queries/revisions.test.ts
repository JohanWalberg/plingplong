import { describe, expect, it } from "vitest";
import { LISTING_TRACKED, LISTING_TRACKED_ADMIN, diffTracked } from "./revisions";

describe("diffTracked", () => {
  it("reports only tracked keys whose value changed, using column names", () => {
    const before = { rentMonthly: 9000, rooms: 2, address: "Storgatan 1", slug: "x", queueRequirement: "queue" };
    const after = { rentMonthly: 9500, rooms: 2, address: "Storgatan 1", slug: "y", queueRequirement: "queue" };
    expect(diffTracked(LISTING_TRACKED, before, after)).toEqual([{ field: "rent_monthly", oldValue: "9000", newValue: "9500" }]);
  });

  it("treats null and undefined as the same empty value and stringifies both sides", () => {
    expect(diffTracked(LISTING_TRACKED, { sizeSqm: null }, {})).toEqual([]);
    expect(diffTracked(LISTING_TRACKED, { rooms: 2 }, { rooms: "2" })).toEqual([]);
    expect(diffTracked(LISTING_TRACKED, { moveInDate: "2026-10-01" }, { moveInDate: null })).toEqual([{ field: "move_in_date", oldValue: "2026-10-01", newValue: null }]);
  });

  it("admin set is a superset of the shared set", () => {
    for (const k of Object.keys(LISTING_TRACKED)) expect(LISTING_TRACKED_ADMIN).toHaveProperty(k);
    expect(diffTracked(LISTING_TRACKED_ADMIN, { floor: 3 }, { floor: 4 })).toEqual([{ field: "floor", oldValue: "3", newValue: "4" }]);
  });
});

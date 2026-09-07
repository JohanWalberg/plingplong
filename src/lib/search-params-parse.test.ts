import { describe, expect, it } from "vitest";
import { parseSearchParams } from "./search-params-parse";
import { toQuery } from "./search-params";

describe("parseSearchParams", () => {
  it("falls back per field instead of failing the page", () => {
    const f = parseSearchParams({ maxRent: "abc", rooms: "1,2", sizeMin: "-5", sort: "bogus", page: "0", queue: "none,weird", moveInBefore: "soon" });
    expect(f.maxRent).toBeUndefined();
    expect(f.rooms).toEqual([1, 2]);
    expect(f.sizeMin).toBeUndefined();
    expect(f.sort).toBe("new");
    expect(f.page).toBe(1);
    expect(f.queue).toEqual([]);
    expect(f.moveInBefore).toBeUndefined();
  });

  it("round-trips through toQuery", () => {
    const f = parseSearchParams({ maxRent: "12000", rooms: "2,3", sizeMin: "40", sizeMax: "90", queue: "none", segment: "student", landlord: "signalisten", moveInBefore: "2026-12-01", sort: "rent", page: "3" });
    expect(parseSearchParams(toQuery(f))).toEqual(f);
  });
});

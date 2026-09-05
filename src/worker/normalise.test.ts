import { describe, expect, it } from "vitest";
import { parseDate, parseMoney, parseQueue, parseRooms, parseSize } from "./normalise";
import { isAnomalousDrop } from "./anomaly";
import { addressSimilarity, decide, scorePair } from "./dedup";

describe("parsers", () => {
  it("money", () => {
    expect(parseMoney("9 340 kr/mån")).toBe(9340);
    expect(parseMoney("9.340,00 kr")).toBe(9340);
    expect(parseMoney("12450")).toBe(12450);
    expect(parseMoney("SEK 12,450")).toBe(12450);
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("Hyra ej angiven")).toBeNull();
  });
  it("rooms and size", () => {
    expect(parseRooms("2 rok")).toBe(2);
    expect(parseRooms("2,5 rum")).toBe(2.5);
    expect(parseSize("54 m²")).toBe(54);
    expect(parseSize(null)).toBeNull();
  });
  it("dates", () => {
    const now = new Date("2026-09-04T00:00:00Z");
    expect(parseDate("2026-09-08", now)).toBe("2026-09-08");
    expect(parseDate("2026-09-08T10:00:00+02:00", now)).toBe("2026-09-08");
    expect(parseDate("8/9 2026", now)).toBe("2026-09-08");
    expect(parseDate("8 september 2026", now)).toBe("2026-09-08");
    expect(parseDate("8 sep", now)).toBe("2026-09-08");
    expect(parseDate("Enligt överenskommelse", now)).toBeNull();
  });
  it("queue words", () => {
    expect(parseQueue("Ingen kö krävs")).toBe("none");
    expect(parseQueue("Köpoäng")).toBe("points");
    expect(parseQueue("Bostadskö")).toBe("queue");
    expect(parseQueue(null)).toBe("unknown");
  });
});

describe("anomaly guard", () => {
  it("flags a drop of more than 60% against the trailing median", () => {
    expect(isAnomalousDrop(4, [96, 95, 94]).anomaly).toBe(true);
    expect(isAnomalousDrop(60, [96, 95, 94]).anomaly).toBe(false);
  });
  it("ignores tiny baselines and first runs", () => {
    expect(isAnomalousDrop(0, []).anomaly).toBe(false);
    expect(isAnomalousDrop(1, [3, 4]).anomaly).toBe(false);
  });
});

describe("dedup", () => {
  const base = { id: "a", landlordId: "L1", municipalityId: "M", address: "Torsgatan 4", rentMonthly: 11890, rooms: 2, sizeSqm: 61, lat: 59.339, lon: 18.05 };
  it("treats apartment suffixes as the same address", () => {
    expect(addressSimilarity("Torsgatan 4, lgh 1402", "Torsgatan 4")).toBe(1);
  });
  it("sends a strong cross-landlord match to review, never merge", () => {
    const s = scorePair(base, { ...base, id: "b", landlordId: "L2", sizeSqm: 62 });
    expect(s.score).toBeGreaterThan(0.9);
    expect(decide(s, false)).toBe("review");
    expect(decide(s, true)).toBe("merge");
  });
  it("ignores different streets", () => {
    const s = scorePair(base, { ...base, id: "b", address: "Upplandsgatan 92", lat: 59.344 });
    expect(decide(s, false)).toBe("ignore");
  });
});

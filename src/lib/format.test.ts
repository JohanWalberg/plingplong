import { describe, expect, it } from "vitest";
import { daysUntil, formatRent, formatRooms, formatSize, formatDateShort, formatPercent } from "./format";

describe("formatters", () => {
  it("formats rent per locale", () => {
    expect(formatRent("sv", 9340)).toBe("9\u00a0340\u00a0kr/mån");
    expect(formatRent("en", 9340)).toBe("SEK\u00a09,340/month");
  });
  it("formats rooms with English plural", () => {
    expect(formatRooms("sv", 1)).toBe("1 rum");
    expect(formatRooms("en", 1)).toBe("1 room");
    expect(formatRooms("en", 2)).toBe("2 rooms");
    expect(formatRooms("sv", 2.5)).toBe("2,5 rum");
  });
  it("formats size", () => {
    expect(formatSize("sv", 54)).toBe("54 m²");
  });
  it("formats short dates", () => {
    expect(formatDateShort("sv", "2026-09-08")).toBe("8 sep.");
    expect(formatDateShort("en", "2026-09-08")).toBe("8 Sept");
  });
  it("formats percent", () => {
    expect(formatPercent("sv", 0.157)).toBe("15,7\u00a0%");
    expect(formatPercent("en", 0.157)).toBe("15.7%");
  });
  it("counts whole days in Stockholm time", () => {
    const now = new Date("2026-09-04T22:30:00Z"); // 00:30 on 5 Sep in Stockholm
    expect(daysUntil("2026-09-05", now)).toBe(0);
    expect(daysUntil("2026-09-06", now)).toBe(1);
    expect(daysUntil("2026-09-04", now)).toBe(-1);
  });
});

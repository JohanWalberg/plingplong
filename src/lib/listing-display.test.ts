import { describe, expect, it } from "vitest";
import { composeBadges, deadlineState, freshnessMessage, initials, type BadgeLabels } from "./listing-display";

const NOW = new Date("2026-09-04T12:43:00Z"); // 14:43 Stockholm
const labels: BadgeLabels = {
  closingToday: "Sista ansökningsdag idag",
  closing: "Ansök snart",
  noQueue: "Ingen kö krävs",
  queue: "Bostadskö krävs",
  points: "Köpoäng används",
  unknownQueue: "Köinformation saknas",
  first: "Förstahandskontrakt",
  sublet: "Andrahandskontrakt",
  student: "Studentbostad",
  youth: "Ungdom",
  senior: "Senior",
  accessible: "Tillgänglighetsanpassad",
  new: "Ny",
  direct: "Publicerad av hyresvärden",
};
const base = {
  applicationDeadline: "2026-09-20",
  queueRequirement: "points" as const,
  contractType: "first_hand" as const,
  segment: "none" as const,
  firstSeenAt: new Date("2026-08-01T00:00:00Z"),
  publishedDirectly: false,
};

describe("deadlineState", () => {
  it("is rolling without a deadline", () => expect(deadlineState(null, NOW).kind).toBe("rolling"));
  it("is today on the deadline day", () => expect(deadlineState("2026-09-04", NOW).kind).toBe("today"));
  it("is tomorrow the day before", () => expect(deadlineState("2026-09-05", NOW).kind).toBe("tomorrow"));
  it("is soon within 48h", () => expect(deadlineState("2026-09-06", NOW).kind).toBe("soon"));
  it("is by otherwise", () => expect(deadlineState("2026-09-10", NOW).kind).toBe("by"));
  it("is closed when passed, never today", () => expect(deadlineState("2026-09-03", NOW).kind).toBe("closed"));
});

describe("composeBadges", () => {
  it("orders deadline, queue, contract and caps at three", () => {
    const b = composeBadges({ ...base, applicationDeadline: "2026-09-04", segment: "student" }, labels, 3, NOW);
    expect(b.map((x) => x.key)).toEqual(["closingToday", "points", "first"]);
  });
  it("never hides the unknown-queue badge", () => {
    const b = composeBadges({ ...base, queueRequirement: "unknown", applicationDeadline: "2026-09-05" }, labels, 3, NOW);
    expect(b.map((x) => x.key)).toEqual(["closing", "unknownQueue", "first"]);
  });
  it("adds New only when there is room", () => {
    const fresh = { ...base, firstSeenAt: new Date("2026-09-04T10:00:00Z") };
    expect(composeBadges(fresh, labels, 3, NOW).map((x) => x.key)).toEqual(["points", "first", "new"]);
    expect(composeBadges({ ...fresh, applicationDeadline: "2026-09-04" }, labels, 3, NOW).map((x) => x.key)).toEqual([
      "closingToday",
      "points",
      "first",
    ]);
  });
  it("shows direct-published on portal listings within the limit", () => {
    const b = composeBadges({ ...base, publishedDirectly: true }, labels, 4, NOW);
    expect(b.map((x) => x.key)).toEqual(["points", "first", "direct"]);
  });
  it("marks colour with icons on urgent and unknown states", () => {
    const b = composeBadges({ ...base, applicationDeadline: "2026-09-04", queueRequirement: "unknown" }, labels, 3, NOW);
    expect(b[0].icon).toBe("warn");
    expect(b[1].icon).toBe("question");
  });
});

describe("freshnessMessage", () => {
  it("buckets by age", () => {
    expect(freshnessMessage("sv", new Date(NOW.getTime() - 2 * 60_000), NOW).key).toBe("justNow");
    expect(freshnessMessage("sv", new Date(NOW.getTime() - 14 * 60_000), NOW)).toEqual({ key: "minutesAgo", values: { count: 14 } });
    expect(freshnessMessage("sv", new Date(NOW.getTime() - 95 * 60_000), NOW)).toEqual({ key: "todayAt", values: { time: "13:08" } });
    expect(freshnessMessage("sv", new Date(NOW.getTime() - 1440 * 60_000), NOW).key).toBe("yesterday");
    expect(freshnessMessage("sv", new Date(NOW.getTime() - 5 * 1440 * 60_000), NOW)).toEqual({ key: "daysAgo", values: { count: 5 } });
    expect(freshnessMessage("sv", null, NOW).key).toBe("never");
  });
});

describe("initials", () => {
  it("skips corporate stop words", () => {
    expect(initials("AB Bostadsstiftelsen Signalisten i Solna")).toBe("BSS");
    expect(initials("Heimstaden Sverige")).toBe("HS");
    expect(initials("Fastighets AB Förvaltaren")).toBe("F");
  });
});

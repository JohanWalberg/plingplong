import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { jsonAdapter, xmlAdapter } from "./feed";
import { htmlAdapter } from "./html";
import { normalise } from "../normalise";
import { AdapterError } from "./types";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const NOW = new Date("2026-09-04T12:00:00Z");

describe("generic-xml adapter", () => {
  const result = xmlAdapter.parse(fixture("signalisten.xml"), {});
  it("finds every listing and maps the dotted paths from the design", () => {
    expect(result.itemCount).toBe(3);
    expect(result.listings).toHaveLength(3);
    expect(result.mapping.address).toBe("address.street");
    expect(result.mapping.rent).toBe("rent.monthly");
    expect(result.mapping.deadline).toBe("application.deadline");
    expect(result.mapping.url).toBe("application.url");
    expect(result.missing).toContain("queue");
  });
  it("normalises values with units and Swedish dates", () => {
    const [a, b, c] = result.listings.map((l) => normalise(l, NOW));
    expect(a.rentMonthly).toBe(9340);
    expect(a.postcode).toBe("169 73");
    expect(a.applicationDeadline).toBe("2026-09-08");
    expect(a.imageUrl).toBe("https://signalisten.se/img/04412-1.jpg");
    expect(b.rentMonthly).toBe(7890);
    expect(b.rooms).toBe(1);
    expect(b.sizeSqm).toBe(41);
    expect(b.applicationDeadline).toBe("2026-09-11");
    expect(c.rentMonthly).toBeNull();
    expect(c.sizeSqm).toBeNull();
    expect(c.applicationDeadline).toBeNull();
    expect(c.queueRequirement).toBe("unknown");
  });
  it("rejects non-XML", () => {
    expect(() => xmlAdapter.parse("hello", {})).toThrow(AdapterError);
  });
});

describe("generic-json adapter", () => {
  const result = jsonAdapter.parse(fixture("forvaltaren.json"), {});
  it("locates the items array without configuration", () => {
    expect(result.itemCount).toBe(2);
    expect(result.mapping.externalId).toBe("objectId");
    expect(result.mapping.municipality).toBe("city");
  });
  it("normalises numbers with commas, queue words and segments", () => {
    const [a, b] = result.listings.map((l) => normalise(l, NOW));
    expect(a.queueRequirement).toBe("queue");
    expect(a.applicationDeadline).toBe("2026-09-04");
    expect(a.lat).toBeCloseTo(59.362);
    expect(b.rentMonthly).toBe(8990);
    expect(b.rooms).toBe(2.5);
    expect(b.sizeSqm).toBe(50.5);
    expect(b.queueRequirement).toBe("none");
    expect(b.segment).toBe("senior");
  });
  it("honours a configured items path and mapping", () => {
    const r = jsonAdapter.parse(fixture("forvaltaren.json"), { itemsPath: "data.apartments", fields: { externalId: "link" } });
    expect(r.listings[0].externalId).toBe("https://www.forvaltaren.se/ledigt/FV-2211");
  });
  it("reports empty documents", () => {
    expect(() => jsonAdapter.parse("{}", {})).toThrow(/No items/);
  });
});

describe("html-list adapter", () => {
  const result = htmlAdapter.parse(fixture("stockholmshem.html"), { listSelector: ".listing-card", headers: { "x-base-url": "https://www.stockholmshem.se/ledigt" } });
  it("reads data attributes, text and hrefs", () => {
    expect(result.listings).toHaveLength(2);
    const a = normalise(result.listings[0], NOW);
    expect(a.externalId).toBe("STH-88213");
    expect(a.address).toBe("Ringvägen 125");
    expect(a.rentMonthly).toBe(7120);
    expect(a.sizeSqm).toBe(38);
    expect(a.sourceUrl).toBe("https://www.stockholmshem.se/ledigt/88213");
  });
  it("fails loudly when the structure changed", () => {
    expect(() => htmlAdapter.parse("<html><body><p>Nothing</p></body></html>", { listSelector: ".listing-card" })).toThrow(/found 0 elements/);
  });
});

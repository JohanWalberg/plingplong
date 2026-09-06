import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeWebsite } from "./safe-url";

describe("safeHttpUrl", () => {
  it("keeps http and https", () => {
    expect(safeHttpUrl("https://example.se/ledigt?x=1")).toBe("https://example.se/ledigt?x=1");
    expect(safeHttpUrl(" http://example.se ")).toBe("http://example.se/");
  });
  it("drops other schemes and junk", () => {
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,hi")).toBeNull();
    expect(safeHttpUrl("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeHttpUrl("not a url")).toBeNull();
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
  it("resolves relative values against a base and refuses over-long values", () => {
    expect(safeHttpUrl("/objekt/123", "https://feed.example.se/list.json")).toBe("https://feed.example.se/objekt/123");
    expect(safeHttpUrl("/objekt/123")).toBeNull();
    expect(safeHttpUrl("https://example.se/" + "a".repeat(2000))).toBeNull();
  });
});

describe("safeWebsite", () => {
  it("adds https to bare domains and rejects bad schemes", () => {
    expect(safeWebsite("foretaget.se")).toBe("https://foretaget.se/");
    expect(safeWebsite("http://foretaget.se")).toBe("http://foretaget.se/");
    expect(safeWebsite("javascript:alert(1)")).toBeNull();
    expect(safeWebsite("")).toBeNull();
  });
});

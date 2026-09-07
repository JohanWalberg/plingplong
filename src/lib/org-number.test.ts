import { describe, expect, it } from "vitest";
import { domainMatches, isValidOrgNumber, normaliseOrgNumber, orgNumberKind } from "./org-number";

describe("org numbers", () => {
  it("normalises ten and twelve digit forms", () => {
    expect(normaliseOrgNumber("5560747551")).toBe("556074-7551");
    expect(normaliseOrgNumber("16 556074-7551")).toBe("556074-7551");
    expect(normaliseOrgNumber("12345")).toBeNull();
  });

  it("checks the Luhn digit", () => {
    expect(isValidOrgNumber("556074-7551")).toBe(true);
    expect(isValidOrgNumber("202100-5448")).toBe(true);
    expect(isValidOrgNumber("556074-7552")).toBe(false);
  });

  it("rejects a twelve digit personal number", () => {
    expect(normaliseOrgNumber("198501011234")).toBeNull();
    expect(isValidOrgNumber("19850101-1234")).toBe(false);
  });

  it("classifies by prefix", () => {
    expect(orgNumberKind("769600-0012")).toBe("brf");
    expect(orgNumberKind("556074-7551")).toBe("company");
    expect(orgNumberKind("802000-0000")).toBe("association");
  });

  it("matches email domains against the website", () => {
    expect(domainMatches("anna@signalisten.se", "https://www.signalisten.se")).toBe(true);
    expect(domainMatches("anna@mail.signalisten.se", "signalisten.se")).toBe(true);
    expect(domainMatches("anna@gmail.com", "signalisten.se")).toBe(false);
    expect(domainMatches("anna@gmail.com", null)).toBeNull();
  });
});

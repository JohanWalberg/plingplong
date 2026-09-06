import { describe, expect, it } from "vitest";
import { parseRegistryResponse } from "./registry";

describe("parseRegistryResponse", () => {
  it("reads Swedish field names and an active status", () => {
    const r = parseRegistryResponse({ organisationsnamn: "AB Bostadsstiftelsen Signalisten i Solna", organisationsform: { kod: "AB", beskrivning: "Aktiebolag" }, registreringsdatum: "1957-03-12", organisationsstatus: "Aktiv" });
    expect(r).toMatchObject({ name: "AB Bostadsstiftelsen Signalisten i Solna", legalForm: "Aktiebolag", registeredAt: "1957-03-12", status: "active" });
  });
  it("marks deregistered companies", () => {
    const r = parseRegistryResponse({ namn: "Gamla Bolaget AB", juridiskForm: "Aktiebolag", avregistreringsdatum: "2021-05-01" });
    expect(r?.status).toBe("deregistered");
  });
  it("returns null for nonsense", () => {
    expect(parseRegistryResponse("no")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, isEncrypted, withPlainApiKey } from "./secrets";

describe("secrets", () => {
  it("round-trips and never stores the plaintext", () => {
    const enc = encryptSecret("sk-live-123");
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("sk-live");
    expect(decryptSecret(enc)).toBe("sk-live-123");
    expect(encryptSecret("x")).not.toBe(encryptSecret("x")); // fresh iv every time
  });

  it("passes legacy plaintext through and rejects a tampered value", () => {
    expect(decryptSecret("plain-key")).toBe("plain-key");
    const enc = encryptSecret("abc");
    expect(() => decryptSecret(enc.slice(0, -2) + "zz")).toThrow();
  });

  it("decrypts a config's api key for use", () => {
    expect(withPlainApiKey({ fields: {}, apiKey: encryptSecret("k") })).toEqual({ fields: {}, apiKey: "k" });
    expect(withPlainApiKey({ fields: {} })).toEqual({ fields: {} });
  });
});

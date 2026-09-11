import { describe, expect, it } from "vitest";
import { assertProductionConfig, productionConfigProblems } from "./env-check";

const good = { NEXT_PUBLIC_SITE_URL: "https://plingplong.se", BETTER_AUTH_URL: "https://plingplong.se", BETTER_AUTH_SECRET: "x".repeat(40), RESEND_API_KEY: "re_123", STORAGE_DRIVER: "s3", S3_BUCKET: "uploads", TRUSTED_PROXY_HOPS: "1" };

describe("production config check", () => {
  it("accepts a complete deploy", () => {
    expect(productionConfigProblems(good)).toEqual([]);
  });

  it("refuses placeholders, http origins and a missing email key on a real origin", () => {
    const p = productionConfigProblems({ ...good, BETTER_AUTH_SECRET: "change-me-change-me-change-me-change-me", BETTER_AUTH_URL: "http://plingplong.se", RESEND_API_KEY: undefined });
    expect(p.join("\n")).toMatch(/BETTER_AUTH_SECRET/);
    expect(p.join("\n")).toMatch(/https/);
    expect(p.join("\n")).toMatch(/RESEND_API_KEY/);
  });

  it("makes the upload destination an explicit choice", () => {
    expect(productionConfigProblems({ ...good, STORAGE_DRIVER: undefined }).join("\n")).toMatch(/STORAGE_DRIVER/);
    expect(productionConfigProblems({ ...good, S3_BUCKET: undefined }).join("\n")).toMatch(/S3_BUCKET/);
    // Disk is allowed, for a host with a volume mounted at UPLOAD_DIR.
    expect(productionConfigProblems({ ...good, STORAGE_DRIVER: "disk", S3_BUCKET: undefined })).toEqual([]);
  });

  it("makes the proxy depth explicit, because every rate limit is keyed on it", () => {
    expect(productionConfigProblems({ ...good, TRUSTED_PROXY_HOPS: undefined }).join("\n")).toMatch(/TRUSTED_PROXY_HOPS/);
    expect(productionConfigProblems({ ...good, TRUSTED_PROXY_HOPS: "one" }).join("\n")).toMatch(/TRUSTED_PROXY_HOPS/);
    // Zero is a real answer: reached directly, so no forwarded header is trusted.
    expect(productionConfigProblems({ ...good, TRUSTED_PROXY_HOPS: "0" })).toEqual([]);
  });

  it("does not treat a real site URL with a leftover localhost auth URL as a test server", () => {
    const p = productionConfigProblems({ ...good, BETTER_AUTH_URL: "http://localhost:3000", RESEND_API_KEY: undefined });
    expect(p.join("\n")).toMatch(/https/);
    expect(p.join("\n")).toMatch(/RESEND_API_KEY/);
  });

  it("lets a localhost production build run without https or email, but still wants the secret and site URL", () => {
    expect(productionConfigProblems({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "x".repeat(40) })).toEqual([]);
    // With no site URL there is no evidence this is a test server, so everything is reported.
    const p = productionConfigProblems({ BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "short" });
    expect(p.join("\n")).toMatch(/NEXT_PUBLIC_SITE_URL/);
    expect(p.join("\n")).toMatch(/BETTER_AUTH_SECRET/);
  });

  it("only throws for a running production server, never during the build", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "production" })).toThrow(/refusing to start/);
    expect(() => assertProductionConfig({ NODE_ENV: "production", ...good })).not.toThrow();
  });
});

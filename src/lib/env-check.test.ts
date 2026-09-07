import { describe, expect, it } from "vitest";
import { assertProductionConfig, productionConfigProblems } from "./env-check";

const good = { NEXT_PUBLIC_SITE_URL: "https://hyrabostad.se", BETTER_AUTH_URL: "https://hyrabostad.se", BETTER_AUTH_SECRET: "x".repeat(40), RESEND_API_KEY: "re_123", STORAGE_DRIVER: "s3", S3_BUCKET: "uploads" };

describe("production config check", () => {
  it("accepts a complete deploy", () => {
    expect(productionConfigProblems(good)).toEqual([]);
  });

  it("refuses placeholders, http origins and a missing email key on a real origin", () => {
    const p = productionConfigProblems({ ...good, BETTER_AUTH_SECRET: "change-me-change-me-change-me-change-me", BETTER_AUTH_URL: "http://hyrabostad.se", RESEND_API_KEY: undefined });
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

  it("lets a localhost production build run without https or email, but still wants the secret and site URL", () => {
    expect(productionConfigProblems({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000", BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "x".repeat(40) })).toEqual([]);
    expect(productionConfigProblems({ BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "short" })).toHaveLength(2);
  });

  it("only throws for a running production server, never during the build", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).not.toThrow();
    expect(() => assertProductionConfig({ NODE_ENV: "production" })).toThrow(/refusing to start/);
    expect(() => assertProductionConfig({ NODE_ENV: "production", ...good })).not.toThrow();
  });
});

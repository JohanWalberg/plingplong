import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows up to max hits in the window and then refuses with a retry hint", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 60, t0 + i).ok).toBe(true);
    const r = rateLimit("k", 3, 60, t0 + 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSeconds).toBe(60);
    expect(rateLimit("k", 3, 60, t0 + 60_001).ok).toBe(true);
  });
});

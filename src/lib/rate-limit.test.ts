import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("a long window beside a short one", () => {
  it("keeps the daily count when a 60-second limit sweeps", () => {
    // The metrics route does exactly this: a per-address limit on every request,
    // then a once-per-visitor-per-home-per-day check. The first must not evict the second.
    const t0 = Date.now();
    const daily = `once:${t0}`;
    expect(rateLimit(daily, 1, 86_400, t0).ok).toBe(true);
    expect(rateLimit(daily, 1, 86_400, t0 + 1_000).ok).toBe(false);
    const later = t0 + 61_000;
    rateLimit(`per-ip:${t0}`, 120, 60, later); // triggers the sweep
    expect(rateLimit(daily, 1, 86_400, later + 1).ok).toBe(false);
  });

  it("still expires an entry once its own window has passed", () => {
    const t0 = Date.now();
    const k = `short:${t0}`;
    expect(rateLimit(k, 1, 60, t0).ok).toBe(true);
    expect(rateLimit(k, 1, 60, t0 + 1_000).ok).toBe(false);
    expect(rateLimit(k, 1, 60, t0 + 60_001).ok).toBe(true);
  });
});

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

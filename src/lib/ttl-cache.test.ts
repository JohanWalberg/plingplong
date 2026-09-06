import { describe, expect, it, vi } from "vitest";
import { invalidate, memoize } from "./ttl-cache";

describe("memoize", () => {
  it("returns the cached value within the ttl and refetches after", async () => {
    let clock = 0;
    const fn = vi.fn(async (x: number) => x * 2);
    const m = memoize("t1", fn, { ttlMs: 100, now: () => clock });
    expect(await m(2)).toBe(4);
    expect(await m(2)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
    clock = 150;
    expect(await m(2)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("keys on arguments and shares one promise between concurrent callers", async () => {
    const fn = vi.fn(async (a: string, b: { n: number }) => `${a}${b.n}`);
    const m = memoize("t2", fn, { ttlMs: 1000 });
    const [x, y, z] = await Promise.all([m("a", { n: 1 }), m("a", { n: 1 }), m("a", { n: 2 })]);
    expect([x, y, z]).toEqual(["a1", "a1", "a2"]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejection", async () => {
    let fail = true;
    const fn = vi.fn(async () => {
      if (fail) throw new Error("db down");
      return "ok";
    });
    const m = memoize("t3", fn, { ttlMs: 1000 });
    await expect(m()).rejects.toThrow("db down");
    fail = false;
    expect(await m()).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("invalidate clears the namespace", async () => {
    const fn = vi.fn(async () => Date.now());
    const m = memoize("t4", fn, { ttlMs: 60_000 });
    await m();
    invalidate("t4");
    await m();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("evicts the oldest entries past max", async () => {
    const fn = vi.fn(async (x: number) => x);
    const m = memoize("t5", fn, { ttlMs: 60_000, max: 2 });
    await m(1);
    await m(2);
    await m(3);
    await m(1); // evicted, fetched again
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("is a passthrough when the ttl is zero", async () => {
    const fn = vi.fn(async () => 1);
    const m = memoize("t6", fn, { ttlMs: 0 });
    await m();
    await m();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

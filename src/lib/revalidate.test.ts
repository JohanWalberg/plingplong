import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestRevalidate } from "./revalidate";

const calls: Array<{ url: string; init: RequestInit }> = [];
let reply: Response | Error = new Response(null, { status: 200 });

beforeEach(() => {
  calls.length = 0;
  reply = new Response(null, { status: 200 });
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (reply instanceof Error) return Promise.reject(reply);
    return Promise.resolve(reply);
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.NEXT_PUBLIC_SITE_URL = "https://plingplong.se/";
  process.env.REVALIDATE_SECRET = "s3cret";
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestRevalidate", () => {
  it("posts the secret in a header and names the reason", async () => {
    expect(await requestRevalidate("sync abc")).toBe(true);
    expect(calls).toHaveLength(1);
    // The trailing slash on the site URL must not produce a double slash.
    expect(calls[0].url).toBe("https://plingplong.se/api/revalidate?reason=sync%20abc");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>)["x-revalidate-secret"]).toBe("s3cret");
  });

  it("does nothing without a secret, so an unconfigured deploy keeps the old behaviour", async () => {
    delete process.env.REVALIDATE_SECRET;
    expect(await requestRevalidate("sync abc")).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal without throwing", async () => {
    reply = new Response(null, { status: 401 });
    await expect(requestRevalidate("sync abc")).resolves.toBe(false);
  });

  it("never lets an unreachable web app fail the job that called it", async () => {
    reply = new Error("ECONNREFUSED");
    await expect(requestRevalidate("sync abc")).resolves.toBe(false);
  });
});

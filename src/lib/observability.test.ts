import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const captured: Array<{ error: unknown; extra?: Record<string, unknown> }> = [];
let initCalls = 0;
let failInit = false;

vi.mock("@sentry/node", () => ({
  init: (opts: Record<string, unknown>) => {
    initCalls++;
    if (failInit) throw new Error("no network");
    lastInit = opts;
  },
  captureException: (error: unknown, hint?: { extra?: Record<string, unknown> }) => void captured.push({ error, extra: hint?.extra }),
}));
let lastInit: Record<string, unknown> = {};

const { errorReportingEnabled, initErrorReporting, reportError } = await import("./observability");

const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  captured.length = 0;
  initCalls = 0;
  failInit = false;
  consoleError.mockClear();
  delete process.env.SENTRY_DSN;
});
afterEach(() => vi.unstubAllEnvs());

describe("error reporting", () => {
  it("is off without a DSN", () => {
    expect(errorReportingEnabled({})).toBe(false);
    expect(errorReportingEnabled({ SENTRY_DSN: "https://k@o.ingest.sentry.io/1" })).toBe(true);
  });

  it("does not start the SDK when there is no DSN", async () => {
    expect(await initErrorReporting("web")).toBe(false);
    expect(initCalls).toBe(0);
  });

  it("still logs every error, so a machine without a DSN shows the failure", () => {
    reportError(new Error("boom"), { sourceId: "abc" });
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.calls[0][0]).toContain("sourceId=abc");
    expect(captured).toHaveLength(0);
  });

  it("starts once and reports with its context once a DSN is set", async () => {
    process.env.SENTRY_DSN = "https://k@o.ingest.sentry.io/1";
    expect(await initErrorReporting("worker")).toBe(true);
    expect(await initErrorReporting("worker")).toBe(false); // already started
    expect(initCalls).toBe(1);
    expect(lastInit).toMatchObject({ tracesSampleRate: 0, initialScope: { tags: { component: "worker" } } });

    const err = new Error("crawl failed");
    reportError(err, { sourceId: "s1" });
    expect(captured).toEqual([{ error: err, extra: { sourceId: "s1" } }]);
  });
});

describe("a broken reporter", () => {
  it("never becomes the failure itself", async () => {
    vi.resetModules();
    failInit = true;
    process.env.SENTRY_DSN = "https://k@o.ingest.sentry.io/1";
    const fresh = await import("./observability");
    await expect(fresh.initErrorReporting("web")).resolves.toBe(false);
    expect(() => fresh.reportError(new Error("still logged"))).not.toThrow();
  });
});

describe("redactedPath", () => {
  it("hides an invitation token in either language's path", async () => {
    const { redactedPath } = await import("./observability");
    expect(redactedPath("/sv/portal/inbjudan/abc123def")).toBe("/sv/portal/inbjudan/[redacted]");
    expect(redactedPath("/en/portal/invite/abc123def")).toBe("/en/portal/invite/[redacted]");
  });

  it("hides token-like query values and keeps the rest", async () => {
    const { redactedPath } = await import("./observability");
    expect(redactedPath("/sv/portal/nytt-losenord?token=t0k&callbackURL=%2Fx")).toBe("/sv/portal/nytt-losenord?token=%5Bredacted%5D&callbackURL=%2Fx");
  });

  it("leaves an ordinary path alone", async () => {
    const { redactedPath } = await import("./observability");
    expect(redactedPath("/sv/bostader/solna?rooms=2")).toBe("/sv/bostader/solna?rooms=2");
  });
});

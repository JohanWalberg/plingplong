import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/net-guard", () => ({
  assertPublicUrl: async () => {},
  BlockedUrlError: class BlockedUrlError extends Error {},
}));

const { politeFetch } = await import("./fetch");

type Route = (url: string) => Response | Promise<Response>;
let routes: Route;
const fetchMock = vi.fn((input: RequestInfo | URL) => routes(String(input)));

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

const text = (body: string, status = 200, type = "text/plain") => new Response(body, { status, headers: { "content-type": type } });

describe("politeFetch", () => {
  it("obeys robots.txt disallow and lets allowed paths through", async () => {
    routes = (url) => (url.endsWith("/robots.txt") ? text("User-agent: *\nDisallow: /private\n") : text("ok"));
    await expect(politeFetch.fetchText("https://h1.test/private/feed")).rejects.toMatchObject({ errorClass: "robots" });
    await expect(politeFetch.fetchText("https://h1.test/public/feed")).resolves.toMatchObject({ status: 200, text: "ok" });
  });

  it("honours Crawl-delay as the gap between requests to one host", async () => {
    routes = (url) => (url.endsWith("/robots.txt") ? text("User-agent: *\nCrawl-delay: 1\n") : text("ok"));
    await politeFetch.fetchText("https://h2.test/a");
    const t0 = Date.now();
    await politeFetch.fetchText("https://h2.test/b");
    expect(Date.now() - t0).toBeGreaterThanOrEqual(900);
  });

  it("maps a timeout to 'unreachable'", async () => {
    routes = (url) => {
      if (url.endsWith("/robots.txt")) return text("", 404);
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    };
    await expect(politeFetch.fetchText("https://h3.test/feed")).rejects.toMatchObject({ errorClass: "unreachable" });
  });

  it("drops the authorization header when a redirect leaves the origin", async () => {
    const seen: Array<[string, HeadersInit | undefined]> = [];
    routes = (url) => {
      if (url.endsWith("/robots.txt")) return text("", 404);
      if (url.startsWith("https://h4.test/")) return new Response(null, { status: 302, headers: { location: "https://elsewhere.test/feed" } });
      return text("moved");
    };
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      seen.push([String(input), init?.headers]);
      return routes(String(input));
    });
    await expect(politeFetch.fetchText("https://h4.test/feed", { headers: { authorization: "Bearer secret" } })).resolves.toMatchObject({ text: "moved" });
    const last = seen.at(-1)!;
    expect(last[0]).toBe("https://elsewhere.test/feed");
    expect(Object.keys(last[1] as Record<string, string>).map((k) => k.toLowerCase())).not.toContain("authorization");
  });
});

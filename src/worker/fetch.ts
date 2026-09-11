import robotsParser from "robots-parser";
import { isIP } from "node:net";
import { Agent, fetch, type Dispatcher } from "undici";
import { AdapterError, type FetchContext } from "./adapters/types";
import { resolvePublicUrl, BlockedUrlError } from "@/lib/net-guard";
import { SITE_URL } from "@/lib/site";

// The URL in the agent string is where a landlord's webmaster lands to read who is crawling them and why.
const USER_AGENT = process.env.CRAWLER_USER_AGENT ?? `plingplong/1.0 (+${SITE_URL}/sv/om-insamling)`;
const ROBOTS_UA = USER_AGENT.split("/")[0];
const TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // decompressed
const MAX_REDIRECTS = 5;
const MIN_GAP_MS = 1000;
const MAX_CRAWL_DELAY_MS = 30_000;

/** One request at a time per host, with a polite minimum gap and jittered backoff on errors. */
class HostQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private lastAt = 0;
  private penalty = 0;
  constructor(private minGapMs: number) {}
  /** robots.txt Crawl-delay, capped so one host cannot stall the worker. */
  setMinGap(ms: number) {
    this.minGapMs = Math.max(MIN_GAP_MS, Math.min(MAX_CRAWL_DELAY_MS, ms));
  }
  run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(async () => {
      const wait = Math.max(0, this.lastAt + this.minGapMs + this.penalty - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        const out = await fn();
        this.penalty = 0;
        return out;
      } catch (e) {
        // Exponential backoff with jitter, capped at 60s.
        this.penalty = Math.min(60_000, Math.max(1000, this.penalty * 2) + Math.random() * 1000);
        throw e;
      } finally {
        this.lastAt = Date.now();
      }
    });
    this.chain = next.catch(() => {});
    return next;
  }
}

const hosts = new Map<string, HostQueue>();

/**
 * One agent per checked address: its sockets connect to exactly that address
 * while TLS still verifies the certificate against the hostname, so the
 * address the guard approved is the address that gets the request.
 */
const agents = new Map<string, Dispatcher>();
function pinnedTo(address: string | null): Dispatcher | undefined {
  if (!address) return undefined;
  let agent = agents.get(address);
  if (!agent) {
    if (agents.size > 200) agents.clear();
    const family = isIP(address);
    agent = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [{ address, family }]);
          else (callback as (err: Error | null, address: string, family: number) => void)(null, address, family);
        },
      },
    });
    agents.set(address, agent);
  }
  return agent;
}

/** The guard's result for one URL, mapped to the adapter error the caller expects. */
async function checkedUrl(raw: string, what = ""): Promise<{ url: URL; address: string | null }> {
  try {
    return await resolvePublicUrl(raw);
  } catch (e) {
    if (e instanceof BlockedUrlError) throw new AdapterError("unreachable", `${what}${e.message}`);
    throw e;
  }
}
const robotsCache = new Map<string, { at: number; robots: ReturnType<typeof robotsParser> | null }>();

function hostQueue(host: string) {
  let q = hosts.get(host);
  if (!q) hosts.set(host, (q = new HostQueue(MIN_GAP_MS)));
  return q;
}

async function robotsAllows(url: string): Promise<boolean> {
  const u = new URL(url);
  const origin = `${u.protocol}//${u.host}`;
  const cached = robotsCache.get(origin);
  let entry = cached && Date.now() - cached.at < 6 * 60 * 60_000 ? cached : undefined;
  if (!entry) {
    let robots: ReturnType<typeof robotsParser> | null = null;
    try {
      const { address } = await checkedUrl(`${origin}/robots.txt`);
      // Through the same per-host queue as the page fetches, so robots.txt counts towards the gap too.
      const res = await hostQueue(u.host).run(() => fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000), redirect: "manual", dispatcher: pinnedTo(address) }));
      if (res.ok) robots = robotsParser(`${origin}/robots.txt`, await readCapped(res, 512 * 1024));
    } catch {
      robots = null; // unreachable robots.txt: treat as allow
    }
    entry = { at: Date.now(), robots };
    robotsCache.set(origin, entry);
    const delay = robots?.getCrawlDelay(ROBOTS_UA);
    if (delay) hostQueue(u.host).setMinGap(delay * 1000);
  }
  if (!entry.robots) return true;
  return entry.robots.isAllowed(url, ROBOTS_UA) !== false;
}

/**
 * Polite fetch: identifies itself, obeys robots.txt, serialises requests per
 * host, and times out. Used by every adapter through FetchContext.
 */
/** Reads a body up to `limit` bytes after decompression; beyond that the source is treated as broken. */
async function readCapped(res: Awaited<ReturnType<typeof fetch>>, limit: number): Promise<string> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > limit) throw new AdapterError("parse_error", `response too large (${declared} bytes)`);
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AdapterError("parse_error", `response too large (over ${limit} bytes)`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const REDIRECT = new Set([301, 302, 303, 307, 308]);

/**
 * Polite fetch: identifies itself, obeys robots.txt, serialises requests per
 * host, times out, caps the body, and only ever talks to public addresses,
 * re-checking every redirect hop. Used by every adapter through FetchContext.
 */
export const politeFetch: FetchContext = {
  async fetchText(url, init) {
    let { address } = await checkedUrl(url);
    if (!(await robotsAllows(url))) throw new AdapterError("robots", `robots.txt disallows ${url}`);
    const host = new URL(url).host;
    return hostQueue(host).run(async () => {
      let current = url;
      let headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/xml, application/json, text/html;q=0.9, */*;q=0.5", ...(init?.headers ?? {}) };
      let res: Awaited<ReturnType<typeof fetch>> | null = null;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        try {
          res = await fetch(current, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "manual", dispatcher: pinnedTo(address) });
        } catch (e) {
          throw new AdapterError("unreachable", (e as Error).message);
        }
        const location = res.headers.get("location");
        if (!REDIRECT.has(res.status) || !location) break;
        if (hop === MAX_REDIRECTS) throw new AdapterError("unreachable", "too many redirects");
        const next = new URL(location, current);
        ({ address } = await checkedUrl(next.toString(), "redirect blocked: "));
        // Credentials never travel to another origin.
        if (next.origin !== new URL(current).origin) headers = Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== "authorization"));
        await res.body?.cancel();
        current = next.toString();
      }
      const text = await readCapped(res!, MAX_BODY_BYTES);
      return { status: res!.status, text, contentType: res!.headers.get("content-type") };
    });
  },
};

export { USER_AGENT };

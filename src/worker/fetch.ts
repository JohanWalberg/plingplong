import robotsParser from "robots-parser";
import { AdapterError, type FetchContext } from "./adapters/types";
import { assertPublicUrl, BlockedUrlError } from "@/lib/net-guard";

const USER_AGENT = process.env.CRAWLER_USER_AGENT ?? "Hyrabostad/1.0 (+https://hyrabostad.se/om-insamling)";
const TIMEOUT_MS = 30_000;
const MAX_BODY_BYTES = 10 * 1024 * 1024; // decompressed
const MAX_REDIRECTS = 5;

/** One request at a time per host, with a polite minimum gap and jittered backoff on errors. */
class HostQueue {
  private chain: Promise<unknown> = Promise.resolve();
  private lastAt = 0;
  private penalty = 0;
  constructor(private readonly minGapMs: number) {}
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
const robotsCache = new Map<string, { at: number; robots: ReturnType<typeof robotsParser> | null }>();

function hostQueue(host: string) {
  let q = hosts.get(host);
  if (!q) hosts.set(host, (q = new HostQueue(1000)));
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
      await assertPublicUrl(`${origin}/robots.txt`);
      const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000), redirect: "manual" });
      if (res.ok) robots = robotsParser(`${origin}/robots.txt`, await readCapped(res, 512 * 1024));
    } catch {
      robots = null; // unreachable robots.txt: treat as allow
    }
    entry = { at: Date.now(), robots };
    robotsCache.set(origin, entry);
  }
  if (!entry.robots) return true;
  return entry.robots.isAllowed(url, USER_AGENT.split("/")[0]) !== false;
}

/**
 * Polite fetch: identifies itself, obeys robots.txt, serialises requests per
 * host, and times out. Used by every adapter through FetchContext.
 */
/** Reads a body up to `limit` bytes after decompression; beyond that the source is treated as broken. */
async function readCapped(res: Response, limit: number): Promise<string> {
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
    try {
      await assertPublicUrl(url);
    } catch (e) {
      if (e instanceof BlockedUrlError) throw new AdapterError("unreachable", e.message);
      throw e;
    }
    if (!(await robotsAllows(url))) throw new AdapterError("robots", `robots.txt disallows ${url}`);
    const host = new URL(url).host;
    return hostQueue(host).run(async () => {
      let current = url;
      let headers: Record<string, string> = { "user-agent": USER_AGENT, accept: "application/xml, application/json, text/html;q=0.9, */*;q=0.5", ...(init?.headers ?? {}) };
      let res: Response | null = null;
      for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
        try {
          res = await fetch(current, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "manual" });
        } catch (e) {
          throw new AdapterError("unreachable", (e as Error).message);
        }
        const location = res.headers.get("location");
        if (!REDIRECT.has(res.status) || !location) break;
        if (hop === MAX_REDIRECTS) throw new AdapterError("unreachable", "too many redirects");
        const next = new URL(location, current);
        try {
          await assertPublicUrl(next.toString());
        } catch (e) {
          if (e instanceof BlockedUrlError) throw new AdapterError("unreachable", `redirect blocked: ${e.message}`);
          throw e;
        }
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

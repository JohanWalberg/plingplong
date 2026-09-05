import robotsParser from "robots-parser";
import { AdapterError, type FetchContext } from "./adapters/types";

const USER_AGENT = process.env.CRAWLER_USER_AGENT ?? "Hyrabostad/1.0 (+https://hyrabostad.se/om-insamling)";
const TIMEOUT_MS = 30_000;

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
      const res = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
      if (res.ok) robots = robotsParser(`${origin}/robots.txt`, await res.text());
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
export const politeFetch: FetchContext = {
  async fetchText(url, init) {
    if (!(await robotsAllows(url))) throw new AdapterError("robots", `robots.txt disallows ${url}`);
    const host = new URL(url).host;
    return hostQueue(host).run(async () => {
      let res: Response;
      try {
        res = await fetch(url, {
          headers: { "user-agent": USER_AGENT, accept: "application/xml, application/json, text/html;q=0.9, */*;q=0.5", ...(init?.headers ?? {}) },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          redirect: "follow",
        });
      } catch (e) {
        throw new AdapterError("unreachable", (e as Error).message);
      }
      const text = await res.text();
      return { status: res.status, text, contentType: res.headers.get("content-type") };
    });
  },
};

export { USER_AGENT };

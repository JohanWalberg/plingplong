/**
 * Worker to web: the worker has no access to Next's cache, so when a crawl
 * changes what search returns it asks the web app to clear it.
 *
 * Unconfigured this is a no-op and the five-minute revalidate window applies,
 * which is the old behaviour. It must never fail a job: the crawl already
 * succeeded by the time this runs.
 */
let warned = false;

export async function requestRevalidate(reason: string, scope: { municipalityIds?: string[]; landlordIds?: string[] } = {}): Promise<boolean> {
  const secret = process.env.REVALIDATE_SECRET;
  const base = process.env.NEXT_PUBLIC_SITE_URL;
  if (!secret || !base) {
    if (!warned) {
      warned = true;
      console.log("[revalidate] not configured (REVALIDATE_SECRET, NEXT_PUBLIC_SITE_URL); public pages will refresh on their own schedule");
    }
    return false;
  }
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/api/revalidate?reason=${encodeURIComponent(reason)}`, {
      method: "POST",
      headers: { "x-revalidate-secret": secret, "content-type": "application/json" },
      body: JSON.stringify(scope),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`[revalidate] ${base} answered ${res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[revalidate] could not reach the web app", (e as Error).message);
    return false;
  }
}

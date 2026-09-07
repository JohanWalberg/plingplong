import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { invalidateListingCaches, invalidateListingCachesFor } from "@/lib/listing-cache";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function secretMatches(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the length.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The worker runs in its own process and cannot reach Next's cache, so after a
 * crawl changes what search would return it asks the web app to clear it here.
 * Without this the change waits out the five-minute revalidate window.
 */
export async function POST(req: Request) {
  const h = await headers();
  if (!rateLimit(`revalidate:${clientIp(h)}`, 60, 60).ok) return new Response(null, { status: 429 });
  if (!secretMatches(h.get("x-revalidate-secret"))) return new Response(null, { status: 401 });
  // A scope names the municipalities and landlords a crawl touched, so only their
  // pages are cleared. Without one (or with an unreadable body) fall back to everything.
  const scope = await req
    .json()
    .then((b: unknown) => (b && typeof b === "object" ? (b as { municipalityIds?: string[]; landlordIds?: string[] }) : null))
    .catch(() => null);
  const reason = new URL(req.url).searchParams.get("reason") ?? "unknown";
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 500) : []);
  if (scope && (ids(scope.municipalityIds).length || ids(scope.landlordIds).length)) {
    const cleared = await invalidateListingCachesFor({ municipalityIds: ids(scope.municipalityIds), landlordIds: ids(scope.landlordIds) });
    console.log(`[revalidate] ${cleared} path(s) cleared (${reason})`);
  } else {
    invalidateListingCaches();
    console.log(`[revalidate] all public pages cleared (${reason})`);
  }
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

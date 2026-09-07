import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { invalidateListingCaches } from "@/lib/listing-cache";
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
  invalidateListingCaches();
  const reason = new URL(req.url).searchParams.get("reason") ?? "unknown";
  console.log(`[revalidate] listing caches cleared (${reason})`);
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}

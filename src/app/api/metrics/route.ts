import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { stockholmDate } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const body = z.object({ listingId: z.string().uuid(), kind: z.enum(["view", "click", "save"]) });

/**
 * Listing metrics: views and outbound clicks, counted per day. Bots that do
 * not run JavaScript never reach this endpoint, which keeps the numbers honest.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`metrics:${clientIp(req.headers)}`, 120, 60);
  if (!limit.ok) return new Response(null, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  let parsed;
  try {
    parsed = body.safeParse(await req.json());
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });
  const ua = req.headers.get("user-agent") ?? "";
  if (/bot|crawl|spider|slurp|headless/i.test(ua)) return new Response(null, { status: 204 });
  // Beacons come from our own pages; a cross-site caller counts for nothing.
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return new Response(null, { status: 204 });

  const { listingId, kind } = parsed.data;
  const col = kind === "view" ? "views" : kind === "click" ? "outbound_clicks" : "saves";
  const day = stockholmDate();
  // One count per visitor, listing, kind and day: reloads and scripts do not inflate the numbers.
  const once = rateLimit(`metrics-once:${kind}:${listingId}:${day}:${clientIp(req.headers)}:${createHash("sha1").update(ua).digest("hex").slice(0, 12)}`, 1, 86_400);
  if (!once.ok) return new Response(null, { status: 204 });
  await db.execute(sql`
    insert into listing_metric_daily (listing_id, day, ${sql.raw(col)})
    select ${listingId}, ${day}, 1 where exists (select 1 from listing where id = ${listingId} and status = 'active')
    on conflict (listing_id, day) do update set ${sql.raw(col)} = listing_metric_daily.${sql.raw(col)} + 1
  `);
  return new Response(null, { status: 204 });
}

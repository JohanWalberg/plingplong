import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** The fields worth reading; browsers send more and older ones name them differently. */
type Report = { "document-uri"?: string; "violated-directive"?: string; "effective-directive"?: string; "blocked-uri"?: string };

const MAX_BODY = 8 * 1024;

/**
 * Where the report-only policy sends its violations. Without somewhere to send
 * them the header produced no signal, which is how a report-only CSP sat in
 * place for months telling nobody anything.
 *
 * Anyone can post here, so it is metered and the body is capped, and only the
 * four fields that say what broke are logged — never the whole report, which
 * can carry page URLs with query strings.
 */
export async function POST(req: Request) {
  const limit = rateLimit(`csp:${clientIp(req.headers)}`, 30, 60);
  if (!limit.ok) return new Response(null, { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } });
  const body = await req.text().catch(() => "");
  if (!body || body.length > MAX_BODY) return new Response(null, { status: 204 });
  try {
    const parsed = JSON.parse(body) as { "csp-report"?: Report };
    const r = parsed["csp-report"];
    if (r) {
      const directive = r["effective-directive"] ?? r["violated-directive"] ?? "?";
      // The path only: a full document-uri can carry a query string.
      const where = r["document-uri"] ? new URL(r["document-uri"]).pathname : "?";
      console.warn(`[csp] ${directive} blocked ${r["blocked-uri"] ?? "?"} on ${where}`);
    }
  } catch {
    // A malformed report is not worth an error response; the browser ignores it either way.
  }
  return new Response(null, { status: 204 });
}

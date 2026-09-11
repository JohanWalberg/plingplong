import { clientIp } from "@/lib/rate-limit";

/**
 * Diagnostic for proxy configuration: shows how the app derives the caller's
 * address so TRUSTED_PROXY_HOPS can be verified from outside. Returns only the
 * caller's own address and the shape of the forwarding chain, never the
 * proxies' addresses.
 */
export async function GET(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const hops = fwd ? fwd.split(",").map((s) => s.trim()).filter(Boolean).length : 0;
  return Response.json(
    {
      clientIp: clientIp(req.headers),
      forwardedEntries: hops,
      trustedProxyHops: process.env.TRUSTED_PROXY_HOPS ?? null,
      hasCfConnectingIp: req.headers.has("cf-connecting-ip"),
      hasTrueClientIp: req.headers.has("true-client-ip"),
      hasXRealIp: req.headers.has("x-real-ip"),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { CLIENT_IP_HEADER, clientIp } from "./lib/rate-limit";

const intl = createMiddleware(routing);

/**
 * Server actions share one body-size limit, and the listing form sets it: up to
 * twelve photos in a single submit. That limit would otherwise also apply to
 * the sign-up form, which anyone can reach and which carries text only — Next
 * buffers the whole body before the action's own rate limit gets to run.
 *
 * So the large body is allowed only where photos are actually posted. Everything
 * else is refused on Content-Length before the body is read. A request without
 * that header still falls back to Next's own limit, as it did before.
 */
const PHOTO_UPLOAD = /\/portal\/(homes|bostader)(\/|$)/;
const SMALL_BODY_BYTES = 1024 * 1024;

/**
 * Better Auth works out the caller's address itself, and its rule is not ours:
 * it reads the left-most X-Forwarded-For entry, which the caller writes. That
 * made its sign-in, sign-up and reset limits free to step around — a new value
 * per request was a new bucket, so password guessing was never slowed down.
 *
 * Here the address is resolved once, by the same trusted-hop rule the rest of
 * the app uses, and passed on in a header the caller cannot forge because it is
 * overwritten on the way in. Auth reads only that header (see lib/auth.ts).
 */
function withClientIp(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(CLIENT_IP_HEADER, clientIp(request.headers));
  return headers;
}

export default function proxy(request: NextRequest) {
  if (request.method === "POST" && !PHOTO_UPLOAD.test(request.nextUrl.pathname)) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > SMALL_BODY_BYTES) return new Response(null, { status: 413 });
  }
  // The auth routes are not localised and must not go through the intl rewrite;
  // they are here only to be given a trustworthy address.
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next({ request: { headers: withClientIp(request) } });
  }
  return intl(request);
}

export const config = {
  // Skip Next internals, uploaded files and static assets. API routes are skipped
  // too, except /api/auth, which needs the resolved address above.
  matcher: ["/((?!api|_next|_vercel|uploads|.*\\..*).*)", "/api/auth/:path*"],
};

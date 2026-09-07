import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

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

export default function proxy(request: NextRequest) {
  if (request.method === "POST" && !PHOTO_UPLOAD.test(request.nextUrl.pathname)) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > SMALL_BODY_BYTES) return new Response(null, { status: 413 });
  }
  return intl(request);
}

export const config = {
  // Skip API routes, Next internals, uploaded files and static assets.
  matcher: "/((?!api|_next|_vercel|uploads|.*\\..*).*)",
};

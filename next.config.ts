import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: false,
  poweredByHeader: false,
  // Unmatched URLs get app/global-not-found.tsx as a full document. A [locale]
  // root layout cannot compose a styled 404 through not-found.tsx (Next renders
  // a bare error shell for non-streamed 404s).
  // Listing photos: up to 12 images of 8 MB each go through one server action.
  experimental: { globalNotFound: true, serverActions: { bodySizeLimit: "100mb" } },
  images: {
    // Uploads (/api/uploads/*) go through the optimizer. Fetched listings hotlink
    // the landlord's own image URL from any host, so ListingImage marks those
    // unoptimized instead of allowlisting hosts here. picsum is the seed data.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // Fonts are self-hosted by next/font; MapLibre fetches its style, tiles,
    // glyphs and sprites from one OpenFreeMap origin and runs a worker served
    // from /public; landlord photos are hotlinked from any https host. Sentry is
    // server-side only, so nothing here has to reach an ingest host.
    //
    // Only the tile host actually configured: listing a provider we no longer
    // use would keep it allowed.
    const tiles = process.env.NEXT_PUBLIC_MAP_STYLE_URL ? new URL(process.env.NEXT_PUBLIC_MAP_STYLE_URL).origin : "https://tiles.openfreemap.org";
    const base = [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      `connect-src 'self' ${tiles}`,
      "worker-src 'self' blob:",
      "child-src blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ];
    /**
     * Enforced. `script-src 'self' 'unsafe-inline'` is the concession: Next
     * inlines its bootstrap, and the nonce that would replace it forces every
     * prerendered page to render dynamically, which would undo the caching work.
     * It still confines scripts to this origin, and nothing here renders HTML
     * from data (no dangerouslySetInnerHTML anywhere in the tree).
     */
    const enforced = [...base, "script-src 'self' 'unsafe-inline'"].join("; ");
    /**
     * The policy we want, reported on but not enforced, so the violations that
     * a move to nonces or hashes would have to answer show up in the log first.
     * Without a report endpoint the old report-only header produced no signal at
     * all, which is why it sat untouched.
     */
    const target = [...base, "script-src 'self'", "report-uri /api/csp-report"].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy", value: enforced },
          { key: "Content-Security-Policy-Report-Only", value: target },
        ],
      },
      {
        source: "/:locale/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

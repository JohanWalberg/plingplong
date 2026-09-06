import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: false,
  poweredByHeader: false,
  // Unmatched URLs get app/global-not-found.tsx as a full document. A [locale]
  // root layout cannot compose a styled 404 through not-found.tsx (Next renders
  // a bare error shell for non-streamed 404s).
  experimental: { globalNotFound: true },
  images: {
    // Uploads (/api/uploads/*) go through the optimizer. Fetched listings hotlink
    // the landlord's own image URL from any host, so ListingImage marks those
    // unoptimized instead of allowlisting hosts here. picsum is the seed data.
    remotePatterns: [{ protocol: "https", hostname: "picsum.photos" }],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    // Fonts are self-hosted by next/font; MapLibre fetches styles and tiles from
    // OpenFreeMap and runs blob workers; landlord photos are hotlinked from any
    // https host. The CSP starts in report-only mode; enforce once reports are clean.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self'",
      `connect-src 'self' https://tiles.openfreemap.org${process.env.NEXT_PUBLIC_MAP_STYLE_URL ? ` ${new URL(process.env.NEXT_PUBLIC_MAP_STYLE_URL).origin}` : ""}`,
      "worker-src 'self' blob:",
      "child-src blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Content-Security-Policy-Report-Only", value: csp },
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

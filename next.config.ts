import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: false,
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
    return [
      {
        source: "/:locale/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: false,
  images: {
    // Fetched listings hotlink the landlord's own image URL; sizes are unknown.
    unoptimized: true,
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

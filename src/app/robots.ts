import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/sv/admin", "/en/admin", "/sv/portal", "/en/portal", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

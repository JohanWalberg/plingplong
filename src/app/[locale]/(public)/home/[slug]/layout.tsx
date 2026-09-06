import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getListingBySlug } from "@/lib/queries/listings";

/**
 * Resolves the listing before the page's loading boundary so an unknown or
 * draft slug answers with a real 404 status instead of a streamed 200 with
 * noindex. The lookup is request-cached, so the page does not repeat it.
 */
export default async function ListingLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  const l = await getListingBySlug(slug);
  if (!l || l.status === "draft") notFound();
  return children;
}

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { landlordBySlug } from "@/lib/queries/landlords";

/** Unknown landlord slugs answer 404 before the loading boundary streams. */
export default async function LandlordLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  if (!(await landlordBySlug(slug))) notFound();
  return children;
}

import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { findMunicipalityBySlug } from "@/lib/queries/places";

/** Unknown municipality slugs answer 404 before the loading boundary streams. */
export default async function MunicipalityLayout({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const { slug } = await params;
  if (!(await findMunicipalityBySlug(slug))) notFound();
  return children;
}

import { SiteHeader } from "@/components/site/header";
import { loadingLocale } from "@/lib/loading-locale";
import { ListingDetailSkeleton } from "@/components/ui/skeletons";

export default async function Loading() {
  await loadingLocale();
  return (
    <>
      <SiteHeader active="search" />
      <main id="main" className="bg-bg">
        <ListingDetailSkeleton />
      </main>
    </>
  );
}

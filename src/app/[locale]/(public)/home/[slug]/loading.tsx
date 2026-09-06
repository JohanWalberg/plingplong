import { SiteHeader } from "@/components/site/header";
import { ListingDetailSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <SiteHeader active="search" />
      <main id="main" className="bg-bg">
        <ListingDetailSkeleton />
      </main>
    </>
  );
}

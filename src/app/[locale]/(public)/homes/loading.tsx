import { SiteHeader } from "@/components/site/header";
import { SearchResultsSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <SiteHeader active="search" />
      <main id="main">
        <SearchResultsSkeleton />
      </main>
    </>
  );
}

import { SiteHeader } from "@/components/site/header";
import { loadingLocale } from "@/lib/loading-locale";
import { MapSkeleton } from "@/components/ui/skeletons";

export default async function Loading() {
  await loadingLocale();
  return (
    <>
      <SiteHeader active="map" />
      <main id="main">
        <MapSkeleton />
      </main>
    </>
  );
}

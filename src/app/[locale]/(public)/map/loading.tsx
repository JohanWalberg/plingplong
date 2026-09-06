import { SiteHeader } from "@/components/site/header";
import { MapSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <SiteHeader active="map" />
      <main id="main">
        <MapSkeleton />
      </main>
    </>
  );
}

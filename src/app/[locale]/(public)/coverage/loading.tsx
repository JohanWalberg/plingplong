import { SiteHeader } from "@/components/site/header";
import { CardGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <CardGridSkeleton />
      </main>
    </>
  );
}

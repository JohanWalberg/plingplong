import { SiteHeader } from "@/components/site/header";
import { CardGridSkeleton } from "@/components/ui/skeletons";

export default function Loading() {
  return (
    <>
      <SiteHeader active="municipalities" />
      <main id="main">
        <CardGridSkeleton cards={3} />
      </main>
    </>
  );
}

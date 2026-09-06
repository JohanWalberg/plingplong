import { SiteHeader } from "@/components/site/header";
import { loadingLocale } from "@/lib/loading-locale";
import { CardGridSkeleton } from "@/components/ui/skeletons";

export default async function Loading() {
  await loadingLocale();
  return (
    <>
      <SiteHeader active="landlords" />
      <main id="main">
        <CardGridSkeleton cards={3} />
      </main>
    </>
  );
}

import { PortalLoading } from "@/components/portal/portal-loading";
import { loadingLocale } from "@/lib/loading-locale";

export default async function Loading() {
  await loadingLocale();
  return <PortalLoading active="statistics" kpis={2} />;
}

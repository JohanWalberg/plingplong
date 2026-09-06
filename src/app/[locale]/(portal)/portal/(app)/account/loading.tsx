import { PortalLoading } from "@/components/portal/portal-loading";
import { loadingLocale } from "@/lib/loading-locale";

export default async function Loading() {
  await loadingLocale();
  return <PortalLoading active="account" kpis={0} />;
}

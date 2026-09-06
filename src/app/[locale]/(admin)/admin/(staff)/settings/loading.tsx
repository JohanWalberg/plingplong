import { AdminLoading } from "@/components/admin/admin-loading";
import { loadingLocale } from "@/lib/loading-locale";

export default async function Loading() {
  await loadingLocale();
  return <AdminLoading active="settings" kpis={0} />;
}

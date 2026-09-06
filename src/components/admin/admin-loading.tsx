import { getTranslations } from "next-intl/server";
import { AdminShell, type AdminNav } from "./admin-shell";
import { DashboardSkeleton } from "@/components/ui/skeletons";

/** Loading state for admin pages: the real sidebar with the section highlighted, skeleton content. */
export async function AdminLoading({ active, kpis = 0 }: { active: AdminNav; kpis?: number }) {
  const t = await getTranslations("admin.nav");
  return (
    <AdminShell viewer={null} active={active} title={t(active)}>
      <DashboardSkeleton kpis={kpis} />
    </AdminShell>
  );
}

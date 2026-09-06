import { PortalShell } from "./portal-shell";
import { DashboardSkeleton } from "@/components/ui/skeletons";

type Tab = NonNullable<Parameters<typeof PortalShell>[0]["active"]>;

/** Loading state for portal pages: the real chrome with the tab highlighted, skeleton content. */
export function PortalLoading({ active, kpis = 0 }: { active: Tab; kpis?: number }) {
  return (
    <PortalShell viewer={null} active={active}>
      <DashboardSkeleton kpis={kpis} />
    </PortalShell>
  );
}

import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

export default function PortalGroupLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

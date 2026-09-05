import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/footer";
import { ToastProvider } from "@/components/ui/toast";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </ToastProvider>
  );
}

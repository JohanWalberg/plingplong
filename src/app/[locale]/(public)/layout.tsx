import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site/footer";
import { ToastProvider } from "@/components/ui/toast";
import { resolveLocale } from "@/lib/locale";

/**
 * The locale is set here as well as in the pages: the footer reads
 * translations inside this layout, and without setRequestLocale in this
 * scope next-intl falls back to request headers, which made every public
 * page dynamic.
 */
export default async function PublicLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  await resolveLocale(params);
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </ToastProvider>
  );
}

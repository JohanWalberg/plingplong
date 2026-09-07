import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { LogoMark } from "@/components/ui/misc";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { SignOutButton } from "@/components/auth/sign-in-form";
import { buttonClasses } from "@/components/ui/button";
import type { LandlordViewer } from "@/lib/access";

type Tab = "homes" | "sources" | "statistics" | "account";
const TABS: Array<{ key: Tab; href: StaticPathname }> = [
  { key: "homes", href: "/portal/homes" },
  { key: "sources", href: "/portal/sources" },
  { key: "statistics", href: "/portal/statistics" },
  { key: "account", href: "/portal/account" },
];

/** Portal chrome for signed-in landlords: own header with tabs, no public nav. A null viewer renders the chrome without account details (loading states). */
export async function PortalShell({ viewer, active, children }: { viewer: LandlordViewer | null; active?: Tab; children: ReactNode }) {
  const t = await getTranslations("portal.nav");
  const tc = await getTranslations("common");
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-line bg-surface">
        <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[200] rounded-md bg-ink px-3 py-2 text-white">
          {tc("skipToContent")}
        </a>
        <div className="mx-auto flex min-h-[64px] max-w-[1200px] items-center gap-4 px-4 sm:px-6">
          <Link href="/portal/homes" className="flex items-center gap-2.5 text-ink hover:text-ink hover:no-underline">
            <LogoMark />
            <span className="text-[17px] font-[700] tracking-tight">{tc("brand")}</span>
            {viewer ? <span className="hidden text-[13px] text-muted sm:inline">· {viewer.landlordName}</span> : null}
          </Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={tc("navMain")}>
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={active === tab.key ? "page" : undefined}
                className={`flex min-h-touch items-center border-b-2 px-3 text-[14.5px] font-[600] hover:no-underline ${active === tab.key ? "border-primary text-ink hover:text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
              >
                {t(tab.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/portal/homes/new" className={buttonClasses("primary", "sm")}>
              {t("newHome")}
            </Link>
            {viewer ? <SignOutButton className="hidden text-ink-2 sm:block" /> : null}
            <LanguageSwitcher />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-hairline px-2 md:hidden" aria-label={tc("navMain")}>
          {TABS.map((tab) => (
            <Link key={tab.key} href={tab.href} aria-current={active === tab.key ? "page" : undefined} className={`flex min-h-touch shrink-0 items-center border-b-2 px-3 text-[14px] font-[600] hover:no-underline ${active === tab.key ? "border-primary text-ink" : "border-transparent text-ink-2"}`}>
              {t(tab.key)}
            </Link>
          ))}
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/** Minimal chrome for portal pages before sign-in (landing, sign-up, sign-in). */
export async function PortalPublicShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const t = await getTranslations("portal.landing");
  const tc = await getTranslations("common");
  const ta = await getTranslations("auth");
  const tp = await getTranslations("footer");
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-[64px] max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 sm:py-0">
          <Link href="/for-landlords" className="flex min-w-0 items-center gap-2.5 text-ink hover:text-ink hover:no-underline">
            <LogoMark />
            <span className="text-[17px] font-[700] tracking-tight">{tc("brand")}</span>
            <span className="hidden text-[13px] text-muted sm:inline">{tc("forLandlords")}</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-4 text-[14px] font-[600] md:flex" aria-label={tc("navMain")}>
            <Link href="/how-it-works" className="text-ink-2 hover:text-ink">
              {t("navHow")}
            </Link>
            <Link href="/coverage" className="text-ink-2 hover:text-ink">
              {t("navCoverage")}
            </Link>
            <Link href="/faq" className="text-ink-2 hover:text-ink">
              {t("navFaq")}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <Link href="/portal/sign-in" className="text-[14px] font-[600] text-ink-2 hover:text-ink">
              {t("navLogin")}
            </Link>
            <Link href="/for-landlords/create-account" className={buttonClasses("primary", "sm")}>
              {t("navCreate")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </header>
      <main id="main" className={`mx-auto w-full flex-1 px-4 py-10 sm:px-6 ${wide ? "max-w-[1200px]" : "max-w-[1040px]"}`}>
        {children}
      </main>
      <p className="flex flex-wrap justify-center gap-x-4 border-t border-line px-4 py-4 text-center text-[13px] text-muted">
        <Link href="/" className="text-muted hover:text-ink">
          {ta("backPublic")}
        </Link>
        <Link href="/terms" className="text-muted hover:text-ink">
          {tp("terms")}
        </Link>
        <Link href="/privacy" className="text-muted hover:text-ink">
          {tp("privacy")}
        </Link>
      </p>
    </div>
  );
}

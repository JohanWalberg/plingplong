import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { Logo } from "@/components/ui/logo";
import { buttonClasses } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import type { ReactNode } from "react";

type NavKey = "search" | "map" | "howItWorks" | "forLandlords";
const NAV: Array<{ key: NavKey; href: StaticPathname }> = [
  { key: "search", href: "/homes" },
  { key: "map", href: "/map" },
  { key: "howItWorks", href: "/how-it-works" },
  { key: "forLandlords", href: "/for-landlords" },
];

const linkBase = "flex min-h-touch items-center rounded-md px-3 text-[14.5px] font-[600] hover:no-underline";
const linkActive = "text-primary bg-primary-subtle hover:text-primary";
const linkIdle = "text-ink-2 hover:bg-canvas hover:text-primary";

/** Lightweight public header: logo left, primary sections centre, account actions right. */
export async function SiteHeader({ active, children }: { active?: NavKey | "landlords" | "municipalities"; children?: ReactNode }) {
  const t = await getTranslations("navigation");
  const tc = await getTranslations("common");
  return (
    <header className="border-b border-line bg-surface">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[200] rounded-md bg-primary px-3 py-2 text-white">
        {tc("skipToContent")}
      </a>
      <div className="mx-auto flex min-h-[64px] max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center hover:no-underline">
          <Logo />
        </Link>
        {children ? <div className="hidden min-w-0 flex-1 md:block">{children}</div> : <div className="flex-1" />}
        <nav aria-label={tc("navMain")} className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.key} href={n.href} aria-current={active === n.key ? "page" : undefined} className={`${linkBase} ${active === n.key ? linkActive : linkIdle}`}>
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/saved" className={`${linkBase} hidden text-ink-2 hover:bg-canvas hover:text-primary lg:flex`}>
            {t("saved")}
          </Link>
          <Link href="/portal/sign-in" className={buttonClasses("secondary", "sm", "hidden sm:inline-flex")}>
            {t("login")}
          </Link>
          <LanguageSwitcher />
        </div>
      </div>
      {children ? <div className="border-t border-hairline px-4 py-2 md:hidden">{children}</div> : null}
      <nav aria-label={tc("navMain")} className="flex gap-1 overflow-x-auto border-t border-hairline px-2 md:hidden">
        {NAV.map((n) => (
          <Link key={n.key} href={n.href} aria-current={active === n.key ? "page" : undefined} className={`${linkBase} shrink-0 ${active === n.key ? linkActive : linkIdle}`}>
            {t(n.key)}
          </Link>
        ))}
        <Link href="/saved" className={`${linkBase} shrink-0 ${linkIdle}`}>
          {t("saved")}
        </Link>
        <Link href="/portal/sign-in" className={`${linkBase} shrink-0 ${linkIdle} sm:hidden`}>
          {t("login")}
        </Link>
      </nav>
    </header>
  );
}

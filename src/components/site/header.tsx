import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "./language-switcher";
import type { ReactNode } from "react";

type NavKey = "search" | "map" | "landlords" | "municipalities";
const NAV: Array<{ key: NavKey; href: StaticPathname }> = [
  { key: "search", href: "/homes" },
  { key: "map", href: "/map" },
  { key: "landlords", href: "/landlords" },
  { key: "municipalities", href: "/municipalities" },
];

export async function SiteHeader({ active, children }: { active?: NavKey; children?: ReactNode }) {
  const t = await getTranslations("navigation");
  const tc = await getTranslations("common");
  return (
    <header className="border-b border-line bg-surface">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[200] rounded-md bg-ink px-3 py-2 text-white">
        {tc("skipToContent")}
      </a>
      <div className="mx-auto flex min-h-[64px] max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-ink hover:text-ink hover:no-underline">
          <Logo />
        </Link>
        {children ? <div className="hidden min-w-0 flex-1 md:block">{children}</div> : <div className="flex-1" />}
        <nav aria-label={tc("navMain")} className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={`flex min-h-touch items-center border-b-2 px-3 text-[14.5px] font-[600] hover:no-underline ${
                active === n.key ? "border-primary text-ink hover:text-ink" : "border-transparent text-ink-2 hover:text-ink"
              }`}
            >
              {t(n.key)}
            </Link>
          ))}
        </nav>
        <Link href="/saved" className="hidden min-h-touch items-center text-[14px] font-[600] text-ink-2 hover:text-ink lg:flex">
          {t("saved")}
        </Link>
        <LanguageSwitcher />
      </div>
      {children ? <div className="border-t border-hairline px-4 py-2 md:hidden">{children}</div> : null}
      <nav aria-label={tc("navMain")} className="flex gap-1 overflow-x-auto border-t border-hairline px-2 md:hidden">
        {NAV.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            aria-current={active === n.key ? "page" : undefined}
            className={`flex min-h-touch shrink-0 items-center border-b-2 px-3 text-[14px] font-[600] hover:no-underline ${
              active === n.key ? "border-primary text-ink" : "border-transparent text-ink-2"
            }`}
          >
            {t(n.key)}
          </Link>
        ))}
        <Link href="/saved" className="flex min-h-touch shrink-0 items-center px-3 text-[14px] font-[600] text-ink-2">
          {t("saved")}
        </Link>
      </nav>
    </header>
  );
}

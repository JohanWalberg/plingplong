import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { sql, eq, and, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { Logo } from "@/components/ui/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { SignOutButton } from "@/components/auth/sign-in-form";
import type { StaffViewer } from "@/lib/access";

export type AdminNav = "overview" | "sources" | "landlords" | "queue" | "listings" | "duplicates" | "coverage" | "settings";
const NAV: Array<{ key: AdminNav; href: StaticPathname }> = [
  { key: "overview", href: "/admin" },
  { key: "sources", href: "/admin/sources" },
  { key: "landlords", href: "/admin/landlords" },
  { key: "queue", href: "/admin/applications" },
  { key: "listings", href: "/admin/listings" },
  { key: "duplicates", href: "/admin/duplicates" },
  { key: "coverage", href: "/admin/coverage" },
  { key: "settings", href: "/admin/settings" },
];

async function badges() {
  const { source, landlordApplication, duplicateCandidate } = schema;
  const [[s], [a], [d]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(source).where(inArray(source.status, ["failed", "needs_review"])),
    db.select({ n: sql<number>`count(*)::int` }).from(landlordApplication).where(eq(landlordApplication.status, "pending")),
    db.select({ n: sql<number>`count(*)::int` }).from(duplicateCandidate).where(and(eq(duplicateCandidate.decision, "pending"))),
  ]);
  return { sources: s.n, queue: a.n, duplicates: d.n } as Partial<Record<AdminNav, number>>;
}

/** Admin chrome. A null viewer renders the sidebar without badges or account details (loading states). */
export async function AdminShell({ viewer, active, title, actions, children }: { viewer: StaffViewer | null; active: AdminNav; title: ReactNode; actions?: ReactNode; children: ReactNode }) {
  const t = await getTranslations("admin.nav");
  const tc = await getTranslations("common");
  const ta = await getTranslations("auth");
  const counts = viewer ? await badges() : {};
  const roleLabel = !viewer ? "" : viewer.role === "lead" ? ta("roleLead") : viewer.role === "engineer" ? ta("roleEngineer") : ta("roleSupport");
  return (
    <div className="flex min-h-dvh bg-canvas">
      <a href="#main" className="sr-only-focusable fixed left-3 top-3 z-[200] rounded-md bg-ink px-3 py-2 text-white">
        {tc("skipToContent")}
      </a>
      <aside className="hidden w-[206px] shrink-0 flex-col bg-dark text-dark-text md:flex">
        <p className="flex items-center gap-2 px-4 py-4">
          <Logo tone="dark" size="sm" />
          <span className="text-[12px] text-dark-muted">{tc("admin")}</span>
        </p>
        <nav className="flex flex-1 flex-col" aria-label={tc("navMain")}>
          {NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={active === n.key ? "page" : undefined}
              className={`flex min-h-touch items-center justify-between border-l-[3px] px-4 text-[14px] font-[600] hover:no-underline ${
                active === n.key ? "border-primary bg-dark-2 text-white hover:text-white" : "border-transparent text-dark-muted hover:bg-dark-2 hover:text-dark-text"
              }`}
            >
              {t(n.key)}
              {counts[n.key] ? <span className="rounded-full bg-primary px-1.5 text-[11px] font-[700] leading-5 text-white">{counts[n.key]}</span> : null}
            </Link>
          ))}
        </nav>
        {viewer ? (
          <div className="border-t border-dark-3 px-4 py-3 text-[12.5px] text-dark-muted">
            <p className="truncate font-[600] text-dark-text">{viewer.name}</p>
            <p>{roleLabel}</p>
            <SignOutButton className="mt-1 text-dark-accent" />
          </div>
        ) : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[60px] flex-wrap items-center gap-3 border-b border-line bg-surface px-4 sm:px-6">
          <nav className="flex gap-1 overflow-x-auto md:hidden" aria-label={tc("navMain")}>
            {NAV.map((n) => (
              <Link key={n.key} href={n.href} aria-current={active === n.key ? "page" : undefined} className={`flex min-h-touch shrink-0 items-center px-2 text-[13px] font-[600] ${active === n.key ? "text-ink underline" : "text-ink-2"}`}>
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <h1 className="text-h2">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            {actions}
            <LanguageSwitcher />
          </div>
        </header>
        <main id="main" className="flex-1 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

/** relative: an absolutely positioned child (a visually hidden label) would otherwise
 * escape the scroll box and widen the whole document. */
export function Table({ children, minWidth = 720 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="relative overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full text-[14px]" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, right = false }: { children?: ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2.5 text-meta font-[650] uppercase tracking-wide text-muted ${right ? "text-right" : "text-left"}`}>{children}</th>;
}

export function Td({ children, right = false, className = "" }: { children?: ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${right ? "text-right tabular" : ""} ${className}`}>{children}</td>;
}

export function Kpi({ label, value, delta, tone = "neutral" }: { label: string; value: string | number; delta?: string; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const color = tone === "good" ? "text-success" : tone === "warn" ? "text-warning-text" : tone === "bad" ? "text-error-text" : "text-muted";
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <p className="text-meta text-muted">{label}</p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="text-[26px] font-[700] leading-none tabular">{value}</span>
        {delta ? <span className={`text-[12.5px] font-[650] ${color}`}>{delta}</span> : null}
      </p>
    </div>
  );
}

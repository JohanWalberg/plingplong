import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { StaticPathname } from "@/i18n/routing";
import { LogoMark } from "@/components/ui/misc";
import { LanguageSwitcher } from "./language-switcher";

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("navigation");
  const tc = await getTranslations("common");
  const year = new Date().getFullYear();

  const cols: Array<{ title: string; links: Array<{ label: string; href: StaticPathname; highlight?: boolean }> }> = [
    {
      title: t("findHome"),
      links: [
        { label: tn("search"), href: "/homes" },
        { label: tn("map"), href: "/map" },
        { label: tn("municipalities"), href: "/municipalities" },
        { label: tn("landlords"), href: "/landlords" },
      ],
    },
    {
      title: t("about"),
      links: [
        { label: t("howItWorks"), href: "/how-it-works" },
        { label: t("coverage"), href: "/coverage" },
        { label: t("faq"), href: "/faq" },
        { label: t("contact"), href: "/contact" },
        { label: t("aboutCollection"), href: "/about-collection" },
      ],
    },
    {
      title: t("forLandlords"),
      links: [
        { label: t("forLandlords"), href: "/for-landlords", highlight: true },
        { label: t("portalLogin"), href: "/portal/sign-in", highlight: true },
        { label: t("connectSource"), href: "/for-landlords" },
        { label: t("publishManually"), href: "/for-landlords" },
        { label: t("terms"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="mt-16 bg-dark text-dark-text">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5">
            <LogoMark />
            <span className="text-[17px] font-[700]">{tc("brand")}</span>
          </p>
          <p className="mt-4 max-w-[36ch] text-[14px] leading-relaxed text-dark-muted">{t("blurb")}</p>
          <div className="mt-4">
            <LanguageSwitcher variant="text" />
          </div>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-[12px] font-[650] uppercase tracking-[.12em] text-dark-muted">{c.title}</h2>
            <ul className="mt-3 flex flex-col gap-1">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className={`inline-flex min-h-9 items-center text-[14.5px] hover:underline ${
                      l.highlight ? "font-[650] text-dark-accent hover:text-dark-accent" : "text-dark-text hover:text-dark-text"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-dark-3">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-3 px-4 py-4 text-[13px] text-dark-muted sm:px-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{t("copyright", { year })}</span>
            <span aria-hidden="true">·</span>
            <Link href="/privacy" className="text-dark-muted hover:text-dark-text">
              {t("privacy")}
            </Link>
            <span aria-hidden="true">·</span>
            <Link href="/cookies" className="text-dark-muted hover:text-dark-text">
              {t("cookies")}
            </Link>
          </p>
          <p>{t("noApply")}</p>
        </div>
      </div>
    </footer>
  );
}

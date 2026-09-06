import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { SearchInput } from "./search-input";
import { buttonClasses } from "@/components/ui/button";

/**
 * Plain GET form: submits `q` to the homes page, which resolves the place and
 * redirects to the canonical municipality or area URL. Works without JS; with
 * JS the input offers place suggestions as you type.
 */
export async function SearchBox({ locale, defaultValue = "", size = "lg", showButton = true }: { locale: Locale; defaultValue?: string; size?: "lg" | "md"; showButton?: boolean }) {
  const t = await getTranslations("home");
  const action = getPathname({ locale, href: "/homes" });
  const lg = size === "lg";
  return (
    <form action={action} method="get" role="search" className={`flex w-full ${lg ? "flex-col gap-2 sm:flex-row" : "flex-row gap-2"}`}>
      <SearchInput
        locale={locale}
        defaultValue={defaultValue}
        placeholder={t("placeholder")}
        label={t("searchLabel")}
        className={`w-full rounded-md border border-line-strong bg-surface pl-11 pr-3 text-ink placeholder:text-faint focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          lg ? "min-h-[52px] text-[16px]" : "min-h-touch text-[15px]"
        }`}
      />
      {showButton ? (
        <button type="submit" className={buttonClasses("primary", lg ? "lg" : "md", "shrink-0")}>
          {t("cta")}
        </button>
      ) : (
        <button type="submit" className="sr-only">
          {t("cta")}
        </button>
      )}
    </form>
  );
}

"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { icons } from "@/components/ui/misc";

/**
 * Shared error boundary body. The error is logged for the console (and Sentry
 * once wired); the user gets the copy from `states.error*` and a retry.
 */
export function ErrorView({ error, reset, home = "/" }: { error: Error & { digest?: string }; reset: () => void; home?: "/" | "/portal/homes" | "/admin" }) {
  const t = useTranslations("states");
  const tc = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-[560px] flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-bg text-error-text">{icons.warn}</span>
      <h1 className="mt-4 font-serif text-[30px] leading-tight">{t("errorTitle")}</h1>
      <p className="mt-2 text-ink-2">{t("errorBody")}</p>
      {error.digest ? <p className="mt-2 font-mono text-meta text-muted">{error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>{tc("tryAgain")}</Button>
        <Link href={home} className="inline-flex min-h-touch items-center px-3 font-[650]">
          {tc("toHome")}
        </Link>
      </div>
    </main>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { confirmSearchAlert, endSearchAlert } from "@/actions/alerts";
import { Button, buttonClasses } from "@/components/ui/button";
import { Callout } from "@/components/ui/misc";

type Props = {
  token: string;
  locale: Locale;
  label: string;
  email: string;
  confirmed: boolean;
  searchHref: Parameters<typeof Link>[0]["href"];
};

/**
 * Confirming and ending are both buttons, never a bare page visit: mail
 * scanners open links, and an alert must not start or stop because one did.
 */
export function AlertControls({ token, label, email, confirmed: initialConfirmed, searchHref }: Props) {
  const t = useTranslations("alerts");
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [ended, setEnded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  function confirm() {
    start(async () => {
      const res = await confirmSearchAlert(token);
      if (res.ok) setConfirmed(true);
      else setFailed(true);
    });
  }
  function end() {
    start(async () => {
      const res = await endSearchAlert(token);
      if (res.ok) setEnded(true);
      else setFailed(true);
    });
  }

  if (failed)
    return (
      <>
        <h1 className="font-serif text-[30px] leading-tight">{t("invalidTitle")}</h1>
        <p className="mt-3 text-ink-2">{t("invalidBody")}</p>
      </>
    );
  if (ended)
    return (
      <>
        <h1 className="font-serif text-[30px] leading-tight">{t("endedTitle")}</h1>
        <p className="mt-3 text-ink-2">{t("endedBody")}</p>
        <p className="mt-6">
          <Link href={searchHref} className={buttonClasses("secondary")}>
            {t("openSearch")}
          </Link>
        </p>
      </>
    );
  if (!confirmed)
    return (
      <>
        <h1 className="font-serif text-[30px] leading-tight">{t("confirmTitle")}</h1>
        <p className="mt-3 text-ink-2">{t("confirmBody", { label })}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={confirm} loading={pending}>
            {t("confirmButton")}
          </Button>
          <Link href={searchHref} className={buttonClasses("secondary", "lg")}>
            {t("openSearch")}
          </Link>
        </div>
      </>
    );
  return (
    <>
      <h1 className="font-serif text-[30px] leading-tight">{t("activeTitle")}</h1>
      <Callout tone="success">{t("activeBody", { label, email })}</Callout>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={searchHref} className={buttonClasses("primary", "lg")}>
          {t("openSearch")}
        </Link>
        <Button variant="secondary" size="lg" onClick={end} loading={pending}>
          {t("endButton")}
        </Button>
      </div>
    </>
  );
}

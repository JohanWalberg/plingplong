"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { requestSearchAlert, type AlertState } from "@/actions/alerts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, ValidationSummary } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";

type Props = { locale: Locale; label: string; place?: string; area?: string; query: Record<string, string> };

/** "Bevaka sökning": asks for an address, the server sends the confirmation mail. */
export function AlertButton({ locale, label, place, area, query }: Props) {
  const t = useTranslations("alerts");
  const ta = useTranslations("actions");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AlertState | null, FormData>(requestSearchAlert, null);
  // A new search means a new dialog: forget the last result when the label changes.
  useEffect(() => setOpen(false), [label]);

  const error = state && !state.ok ? t(state.error === "email" ? "errorEmail" : state.error === "rate_limited" ? "errorRate" : state.error === "limit" ? "errorLimit" : "errorInvalid") : null;

  return (
    <>
      <Button variant="tertiary" size="sm" onClick={() => setOpen(true)} icon={<BellIcon />}>
        {ta("watchSearch")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("title")}>
        {state?.ok ? (
          <Callout tone="success" title={t("sentTitle")}>
            {t("sentBody", { email: state.email })}
          </Callout>
        ) : (
          <form action={action} noValidate className="flex flex-col gap-4">
            <p className="text-[14.5px] text-ink-2">{t("body", { label })}</p>
            {error ? <ValidationSummary title={error} /> : null}
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="label" value={label} />
            <input type="hidden" name="place" value={place ?? ""} />
            <input type="hidden" name="area" value={area ?? ""} />
            <input type="hidden" name="query" value={JSON.stringify(query)} />
            <Input label={t("email")} name="email" type="email" autoComplete="email" inputMode="email" required error={state && !state.ok && state.error === "email" ? t("errorEmail") : undefined} />
            <Button type="submit" size="lg" loading={pending}>
              {t("submit")}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8a5 5 0 0 1 10 0v3l1.5 2.5h-13L5 11z" />
      <path d="M8 16a2 2 0 0 0 4 0" />
    </svg>
  );
}

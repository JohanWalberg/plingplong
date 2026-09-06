"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { submitApplication, type SignupState } from "@/actions/signup";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, RadioBox, ValidationSummary } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";
import { Link } from "@/i18n/navigation";

export function SignupForm({ manualPublishing = true }: { manualPublishing?: boolean }) {
  const t = useTranslations("portal.signup");
  const ta = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [state, action, pending] = useActionState<SignupState | null, FormData>(submitApplication, null);
  const [route, setRoute] = useState<"source" | "manual">("source");
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state && !state.ok) summaryRef.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <Callout tone="success" title={t("doneTitle")}>
        {t("doneBody", { email: state.email })}
      </Callout>
    );
  }

  const errors = state && !state.ok ? state.errors : {};
  const err = (field: string) => {
    const code = errors[field];
    if (!code) return undefined;
    if (field === "orgNumber" && code === "taken") return t("orgTaken");
    if (field === "orgNumber") return t("orgNumberInvalid");
    if (field === "email" && code === "taken") return t("emailTaken");
    if (field === "email") return t("emailInvalid");
    if (field === "terms") return t("termsRequired");
    if (field === "password") return ta("passwordHint");
    return t("fieldRequired");
  };
  const errorCount = Object.keys(errors).length;

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {errorCount ? (
        <div ref={summaryRef} tabIndex={-1}>
          <ValidationSummary title={t("validationTitle", { count: errorCount })} body={t("validationBody")} />
        </div>
      ) : null}
      <input type="hidden" name="locale" value={locale} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("orgNumber")} name="orgNumber" hint={t("orgNumberHint")} error={err("orgNumber")} inputMode="numeric" autoComplete="off" required />
        <Input label={t("companyName")} name="companyName" error={err("companyName")} required wrapperClassName="sm:col-span-2" />
        <Input label={t("website")} name="website" hint={t("websiteHint")} error={err("website")} inputMode="url" placeholder="foretaget.se" />
        <Input label={t("contactName")} name="contactName" placeholder={t("contactNamePlaceholder")} error={err("contactName")} required autoComplete="name" />
        <Input label={t("email")} name="email" type="email" hint={t("emailHint")} error={err("email")} required autoComplete="email" />
        <Input label={t("phone")} name="phone" type="tel" hint={t("phoneHint")} error={err("phone")} autoComplete="tel" />
        <Input label={t("password")} name="password" type="password" hint={t("passwordHint")} error={err("password")} required autoComplete="new-password" wrapperClassName="sm:col-span-2" />
      </div>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-2 text-label font-[650]">{t("pathLabel")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <RadioBox name="publishingRoute" value="source" checked={route === "source"} onChange={() => setRoute("source")} label={t("pathSource")} description={t("pathSourceBody")} />
          {manualPublishing ? <RadioBox name="publishingRoute" value="manual" checked={route === "manual"} onChange={() => setRoute("manual")} label={t("pathManual")} description={t("pathManualBody")} /> : null}
        </div>
        {route === "source" ? (
          <div className="mt-3">
            <Input label={t("sourceUrl")} name="sourceUrl" hint={t("sourceUrlHint")} inputMode="url" placeholder="https://" className="font-mono text-[14px]" />
          </div>
        ) : null}
      </fieldset>

      <div>
        <Checkbox
          name="terms"
          label={
            <>
              {t("terms")}{" "}
              <Link href="/terms" target="_blank" className="font-[650]">
                {t("termsLink")}
              </Link>
            </>
          }
        />
        {err("terms") ? <p className="text-meta font-[600] text-error-text">{err("terms")}</p> : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={pending} loadingLabel={ta("signingIn")} className="sm:self-start">
          {t("submit")}
        </Button>
        <p className="text-meta text-muted">{t("submitNote")}</p>
      </div>
    </form>
  );
}

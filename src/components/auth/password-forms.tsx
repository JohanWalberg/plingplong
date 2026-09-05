"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, ValidationSummary } from "@/components/ui/form";
import { Callout } from "@/components/ui/misc";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setLoading(true);
    await authClient.requestPasswordReset({ email, redirectTo: getPathname({ locale, href: "/portal/reset-password" }) });
    setLoading(false);
    setSent(true);
  }
  if (sent) return <Callout tone="success">{t("resetSent")}</Callout>;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <p className="text-[14.5px] text-ink-2">{t("forgotBody")}</p>
      <Input label={t("email")} name="email" type="email" autoComplete="email" required />
      <Button type="submit" size="lg" loading={loading}>
        {t("sendResetLink")}
      </Button>
    </form>
  );
}

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const search = useSearchParams();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const p1 = String(fd.get("password") ?? "");
    const p2 = String(fd.get("password2") ?? "");
    if (p1.length < 10 || p1 !== p2) {
      setError(t("passwordHint"));
      return;
    }
    const token = search.get("token") ?? "";
    setLoading(true);
    const res = await authClient.resetPassword({ newPassword: p1, token });
    setLoading(false);
    if (res.error) setError(t("inviteInvalid"));
    else setDone(true);
  }
  if (done) return <Callout tone="success">{t("resetDone")}</Callout>;
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <ValidationSummary title={error} /> : null}
      <Input label={t("newPassword")} name="password" type="password" autoComplete="new-password" hint={t("passwordHint")} required />
      <Input label={t("repeatPassword")} name="password2" type="password" autoComplete="new-password" required />
      <Button type="submit" size="lg" loading={loading}>
        {t("resetTitle")}
      </Button>
    </form>
  );
}

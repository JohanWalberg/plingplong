"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { acceptInvitation } from "@/actions/invite";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, ValidationSummary } from "@/components/ui/form";

export function AcceptInviteForm({ token, locale, email }: { token: string; locale: Locale; email: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 10) {
      setError(t("passwordHint"));
      return;
    }
    start(async () => {
      const res = await acceptInvitation(token, locale, fd);
      if (!res.ok) {
        setError(t("inviteInvalid"));
        return;
      }
      const signIn = await authClient.signIn.email({ email, password });
      router.push(signIn.error ? "/portal/sign-in" : "/portal/homes");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <ValidationSummary title={error} /> : null}
      <Input label={t("email")} value={email} readOnly name="email" type="email" />
      <Input label={t("name")} name="name" autoComplete="name" required />
      <Input label={t("newPassword")} name="password" type="password" autoComplete="new-password" hint={t("passwordHint")} required />
      <Button type="submit" size="lg" loading={pending}>
        {t("inviteAccept")}
      </Button>
    </form>
  );
}

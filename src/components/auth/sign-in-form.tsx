"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input, ValidationSummary } from "@/components/ui/form";

export function SignInForm({ surface }: { surface: "portal" | "admin" }) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const search = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Only a message: a link with ?denied=1 must not be able to sign anyone out.
  // Signing in below replaces whatever session the browser still has.
  useEffect(() => {
    if (search.get("expired")) setError(t("sessionExpired"));
    else if (search.get("denied")) setError(t("noAccess"));
  }, [search, t]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      setError(t("invalidCredentials"));
      return;
    }
    setLoading(true);
    const res = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (res.error) {
      setError(t("invalidCredentials"));
      return;
    }
    router.push(surface === "admin" ? "/admin" : "/portal/homes");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <ValidationSummary title={error} /> : null}
      <Input label={t("email")} name="email" type="email" autoComplete="email" required inputMode="email" />
      <Input label={t("password")} name="password" type="password" autoComplete="current-password" required />
      <Button type="submit" size="lg" loading={loading} loadingLabel={t("signingIn")}>
        {t("signIn")}
      </Button>
      {surface === "portal" ? (
        <p className="text-[14px]">
          <Link href="/portal/forgot-password">{t("forgot")}</Link>
        </p>
      ) : null}
      <input type="hidden" name="locale" value={locale} />
    </form>
  );
}

export function SignOutButton({ className = "" }: { className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <button
      type="button"
      className={`min-h-touch text-[14px] font-[600] ${className}`}
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      {t("signOut")}
    </button>
  );
}

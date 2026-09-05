"use client";

import { useActionState, useEffect, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { runSourceNow, setSourceEnabled, updateSourceSettings, type ConnectState } from "@/actions/portal-sources";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function RunNowButton({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const t = useTranslations("portal.source");
  const locale = useLocale() as Locale;
  const { toast } = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size={size} loading={pending} onClick={() => start(async () => { const r = await runSourceNow(locale, id); if (r.ok) toast(t("runQueued")); router.refresh(); })}>
      {t("runNow")}
    </Button>
  );
}

export function EnableToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const t = useTranslations("portal.source");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant={enabled ? "danger" : "primary"} size="md" loading={pending} onClick={() => start(async () => { await setSourceEnabled(locale, id, !enabled); router.refresh(); })}>
      {enabled ? t("disable") : t("enable")}
    </Button>
  );
}

export function SourceSettingsForm({ id, interval, techContact, queueDefault, hasApiKey, kind }: { id: string; interval: number; techContact: string; queueDefault: string; hasApiKey: boolean; kind: string }) {
  const t = useTranslations("portal.source");
  const locale = useLocale() as Locale;
  const { toast } = useToast();
  const router = useRouter();
  const [state, action, pending] = useActionState<ConnectState, FormData>(updateSourceSettings.bind(null, locale, id), null);
  useEffect(() => {
    if (state?.ok) {
      toast(t("saved"));
      router.refresh();
    }
  }, [state, toast, t, router]);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Select label={t("freqLabel")} name="fetchIntervalMinutes" defaultValue={String(interval)}>
        <option value="60">{t("freqHourly")}</option>
        <option value="240">{t("freq4h")}</option>
        <option value="1440">{t("freqDaily")}</option>
      </Select>
      <Input label={t("contactLabel")} name="techContactEmail" type="email" defaultValue={techContact} />
      {kind === "api" ? <Input label={t("apiKeyLabel")} name="apiKey" type="password" placeholder={hasApiKey ? "••••••••" : ""} hint={t("apiKeyHint")} autoComplete="off" /> : null}
      <Select label={t("queueDefaultLabel")} name="queueDefault" hint={t("queueDefaultHint")} defaultValue={queueDefault}>
        <option value="">{t("queueDefaultNone")}</option>
        <option value="none">{locale === "sv" ? "Ingen kö krävs" : "No queue required"}</option>
        <option value="queue">{locale === "sv" ? "Bostadskö krävs" : "Housing queue required"}</option>
        <option value="points">{locale === "sv" ? "Köpoäng används" : "Queue points used"}</option>
      </Select>
      <Button type="submit" loading={pending} className="self-start">
        {t("saveSettings")}
      </Button>
    </form>
  );
}

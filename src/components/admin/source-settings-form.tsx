"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { createSource, updateSource } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Select, ValidationSummary } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

type SourceValues = { id?: string; landlordId?: string; kind?: "feed" | "api" | "html"; url: string; adapter: string; fetchIntervalMinutes: number; techContactEmail: string; queueDefault: string; consent: string; listSelector: string };

export function SourceSettingsForm({ source, canEdit, landlords }: { source: SourceValues; canEdit: boolean; landlords?: Array<{ id: string; name: string }> }) {
  const t = useTranslations("admin.sources");
  const tp = useTranslations("portal.source");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"feed" | "api" | "html">(source.kind ?? (source.adapter === "html-list" ? "html" : "feed"));
  const isNew = !source.id;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = isNew ? await createSource(locale, fd) : await updateSource(locale, source.id!, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast(tc("save"), "success");
      if (isNew && "id" in res) router.push({ pathname: "/admin/sources/[id]", params: { id: res.id } });
      else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <ValidationSummary title={error} /> : null}
      {isNew && landlords ? (
        <Select label={t("landlord")} name="landlordId" required defaultValue="">
          <option value="" disabled>
            —
          </option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      ) : null}
      {isNew ? (
        <Select label={t("kind")} name="kind" value={kind} onChange={(e) => setKind(e.target.value as "feed")}>
          <option value="feed">{t("typeFeed")}</option>
          <option value="api">{t("typeApi")}</option>
          <option value="html">{t("typeHtml")}</option>
        </Select>
      ) : null}
      <Input label={t("url")} name="url" defaultValue={source.url} inputMode="url" required className="font-mono text-[13px]" readOnly={!canEdit} />
      <Select label={t("adapter")} name="adapter" defaultValue={source.adapter} hint={t("adapterHint")} disabled={!canEdit}>
        <option value="generic-xml">generic-xml</option>
        <option value="generic-json">generic-json</option>
        <option value="html-list">html-list</option>
      </Select>
      {kind === "html" || source.adapter === "html-list" ? <Input label="listSelector" name="listSelector" defaultValue={source.listSelector} className="font-mono text-[13px]" readOnly={!canEdit} /> : null}
      {kind === "api" ? <Input label={tp("apiKeyLabel")} name="apiKey" type="password" hint={tp("apiKeyHint")} autoComplete="off" /> : null}
      <Select label={t("interval")} name="fetchIntervalMinutes" defaultValue={String(source.fetchIntervalMinutes)} disabled={!canEdit}>
        <option value="60">{tp("freqHourly")}</option>
        <option value="240">{tp("freq4h")}</option>
        <option value="1440">{tp("freqDaily")}</option>
      </Select>
      <Input label={t("techContact")} name="techContactEmail" type="email" defaultValue={source.techContactEmail} readOnly={!canEdit} />
      <Select label={t("queueDefault")} name="queueDefault" defaultValue={source.queueDefault} disabled={!canEdit}>
        <option value="">{tp("queueDefaultNone")}</option>
        <option value="none">{tp("fieldQueue")}: none</option>
        <option value="queue">{tp("fieldQueue")}: queue</option>
        <option value="points">{tp("fieldQueue")}: points</option>
      </Select>
      <Select label={t("consent")} name="consent" defaultValue={source.consent} disabled={!canEdit}>
        {(["unknown", "consented", "objected", "silent"] as const).map((c) => (
          <option key={c} value={c}>
            {t(`consent${c[0].toUpperCase()}${c.slice(1)}` as "consentUnknown")}
          </option>
        ))}
      </Select>
      {canEdit ? (
        <Button type="submit" loading={pending}>
          {isNew ? t("create") : tc("save")}
        </Button>
      ) : null}
    </form>
  );
}

"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { upsertLandlord } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Checkbox, Fieldset, Input, Select, ValidationSummary } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionFailure } from "@/lib/action-result";

type Values = { id?: string; name: string; orgNumber: string; website: string; type: string; queueType: string; queueInfoUrl: string; isKnown: boolean; municipalityIds: string[] };

export function LandlordForm({ values, municipalities, canEdit }: { values: Values; municipalities: Array<{ id: string; name: string }>; canEdit: boolean }) {
  const t = useTranslations("admin.landlords");
  const tl = useTranslations("landlord");
  const tc = useTranslations("common");
  const te = useTranslations("admin.errors");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [error, setError] = useState<ActionFailure | null>(null);
  const bad = new Set(error?.fields ?? []);
  const fe = (name: string) => (bad.has(name) ? te("checkField") : undefined);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await upsertLandlord(locale, values.id ?? null, fd);
      if (!res.ok) {
        setError(res);
        return;
      }
      toast(tc("save"), "success");
      if (!values.id) router.push({ pathname: "/admin/landlords/[id]", params: { id: res.id } });
      else router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <ValidationSummary title={te(error.error)} /> : null}
      <Input label={t("name")} name="name" defaultValue={values.name} required readOnly={!canEdit} error={fe("name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label={t("orgNumber")} name="orgNumber" defaultValue={values.orgNumber} readOnly={!canEdit} error={fe("orgNumber")} />
        <Input label={t("website")} name="website" defaultValue={values.website} readOnly={!canEdit} error={fe("website")} />
        <Select label={t("type")} name="type" defaultValue={values.type} disabled={!canEdit} error={fe("type")}>
          {(["municipal", "private", "agency", "foundation"] as const).map((x) => (
            <option key={x} value={x}>
              {tl(`type${x[0].toUpperCase()}${x.slice(1)}` as "typePrivate")}
            </option>
          ))}
        </Select>
        <Select label={t("queueType")} name="queueType" defaultValue={values.queueType} disabled={!canEdit} error={fe("queueType")}>
          {(["none", "queue", "points", "unknown"] as const).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Select>
        <Input label={t("queueInfoUrl")} name="queueInfoUrl" defaultValue={values.queueInfoUrl} readOnly={!canEdit} wrapperClassName="sm:col-span-2" error={fe("queueInfoUrl")} />
      </div>
      <Checkbox name="isKnown" label={t("isKnown")} defaultChecked={values.isKnown} disabled={!canEdit} />
      <Fieldset legend={t("municipalities")}>
        <div className="grid max-h-[280px] grid-cols-2 gap-x-4 overflow-y-auto rounded-md border border-line p-3 sm:grid-cols-3">
          {municipalities.map((m) => (
            <Checkbox key={m.id} name="municipalityIds" value={m.id} label={m.name} defaultChecked={values.municipalityIds.includes(m.id)} disabled={!canEdit} className="min-h-9 py-1" />
          ))}
        </div>
      </Fieldset>
      {canEdit ? (
        <Button type="submit" loading={pending} className="self-start">
          {values.id ? t("save") : t("create")}
        </Button>
      ) : null}
    </form>
  );
}

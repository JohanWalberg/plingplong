"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { adminUpdateListing } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, ValidationSummary } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import type { ActionFailure } from "@/lib/action-result";

type Values = {
  id: string; address: string; areaName: string; rentMonthly: string; rooms: string; sizeSqm: string; floor: string;
  moveInDate: string; applicationDeadline: string; queueRequirement: string; segment: string; applicationUrl: string; description: string;
};

export function ListingEditForm({ values }: { values: Values }) {
  const t = useTranslations("admin.listings");
  const tp = useTranslations("portal.perf");
  const ta = useTranslations("portal.add");
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
      const res = await adminUpdateListing(locale, values.id, fd);
      if (!res.ok) {
        setError(res);
        return;
      }
      toast(t("saved"), "success");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {error ? <ValidationSummary title={te(error.error)} /> : null}
      <p className="text-meta text-muted">{t("editNote")}</p>
      <Input label={tp("fieldAddress")} name="address" defaultValue={values.address} required error={fe("address")} />
      <Input label={t("fieldArea")} name="areaName" defaultValue={values.areaName} error={fe("areaName")} />
      <div className="grid grid-cols-2 gap-3">
        <Input label={tp("fieldRent")} name="rentMonthly" defaultValue={values.rentMonthly} inputMode="numeric" suffix={ta("rentUnit")} error={fe("rentMonthly")} />
        <Input label={tp("fieldRooms")} name="rooms" defaultValue={values.rooms} inputMode="decimal" error={fe("rooms")} />
        <Input label={tp("fieldSize")} name="sizeSqm" defaultValue={values.sizeSqm} inputMode="decimal" suffix="m²" error={fe("sizeSqm")} />
        <Input label={t("fieldFloor")} name="floor" defaultValue={values.floor} inputMode="numeric" error={fe("floor")} />
        <Input label={tp("fieldMoveIn")} name="moveInDate" defaultValue={values.moveInDate} placeholder="YYYY-MM-DD" error={fe("moveInDate")} />
        <Input label={tp("fieldDeadline")} name="applicationDeadline" defaultValue={values.applicationDeadline} placeholder="YYYY-MM-DD" error={fe("applicationDeadline")} />
      </div>
      <Select label={t("fieldQueue")} name="queueRequirement" defaultValue={values.queueRequirement} error={fe("queueRequirement")}>
        {(["none", "queue", "points", "unknown"] as const).map((q) => (
          <option key={q} value={q}>
            {ta(q === "none" ? "queueNone" : q === "queue" ? "queueRequired" : q === "points" ? "queuePoints" : "queueUnknown")}
          </option>
        ))}
      </Select>
      <Select label={t("fieldSegment")} name="segment" defaultValue={values.segment} error={fe("segment")}>
        <option value="none">{ta("segmentNone")}</option>
        {(["student", "youth", "senior", "accessible"] as const).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <Input label={t("fieldUrl")} name="applicationUrl" defaultValue={values.applicationUrl} inputMode="url" className="font-mono text-[13px]" error={fe("applicationUrl")} />
      <Textarea label={t("fieldDescription")} name="description" defaultValue={values.description} error={fe("description")} />
      <Button type="submit" loading={pending} className="self-start">
        {tc("save")}
      </Button>
    </form>
  );
}

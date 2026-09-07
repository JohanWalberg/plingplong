"use client";

import Image from "next/image";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { saveListing, type ListingFormState } from "@/actions/portal-listings";
import { Button } from "@/components/ui/button";
import { Fieldset, Input, Radio, RadioBox, Select, Textarea, ValidationSummary } from "@/components/ui/form";
import { Card, icons } from "@/components/ui/misc";
import { CardPreview } from "./card-preview";
import type { QueueRequirement, Segment } from "@/db/schema";

export type ListingFormValues = {
  address: string;
  postcode: string;
  municipalityId: string;
  areaName: string;
  rentMonthly: string;
  rooms: string;
  sizeSqm: string;
  floor: string;
  moveInDate: string;
  applicationDeadline: string;
  segment: Segment;
  description: string;
  queueRequirement: QueueRequirement;
  applyRoute: "url" | "contact";
  applicationUrl: string;
  applicationContact: string;
};

type Props = {
  existingId: string | null;
  initial: ListingFormValues;
  status: "draft" | "active" | "unpublished" | "expired" | "removed" | "unknown" | null;
  municipalities: Array<{ id: string; label: string }>;
  images: Array<{ id: string; url: string }>;
  landlordName: string;
  canPublish: boolean;
};

const EMPTY: ListingFormState | null = null;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isNumber = (v: string) => v.trim() === "" || Number.isFinite(Number(v.replace(/\s/g, "").replace(",", ".")));

/** Client-side mirror of the server's validate(): only formats and required address fields; publish-only requirements stay in the summary. */
function inlineErrors(v: ListingFormValues): Record<string, "required" | "invalidNumber" | "invalidUrl" | "invalidDate"> {
  const e: Record<string, "required" | "invalidNumber" | "invalidUrl" | "invalidDate"> = {};
  if (!v.address.trim()) e.address = "required";
  if (!v.municipalityId) e.municipalityId = "required";
  for (const k of ["rentMonthly", "rooms", "sizeSqm"] as const) if (!isNumber(v[k])) e[k] = "invalidNumber";
  if (v.floor.trim() && !Number.isInteger(Number(v.floor))) e.floor = "invalidNumber";
  if (v.moveInDate && !isoDate.test(v.moveInDate)) e.moveInDate = "invalidDate";
  if (v.applicationDeadline && !isoDate.test(v.applicationDeadline)) e.applicationDeadline = "invalidDate";
  if (v.applyRoute === "url" && v.applicationUrl && !/^https?:\/\//.test(v.applicationUrl)) e.applicationUrl = "invalidUrl";
  return e;
}

export function ListingForm({ existingId, initial, status, municipalities, images, landlordName, canPublish }: Props) {
  const t = useTranslations("portal.add");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [values, setValues] = useState<ListingFormValues>(initial);
  const [mode, setMode] = useState<"draft" | "publish">("draft");
  const [removed, setRemoved] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const action = useMemo(() => saveListing.bind(null, locale, mode, existingId), [locale, mode, existingId]);
  const [state, formAction, pending] = useActionState<ListingFormState | null, FormData>(
    async (prev, fd) => {
      // The pending file list lives in React state (the input is cleared after picking), so add them here.
      fd.delete("images");
      for (const f of pendingFiles) fd.append("images", f);
      for (const id of removed) fd.append("removeImages", id);
      return action(prev, fd);
    },
    EMPTY,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.published) router.push({ pathname: "/portal/homes/[id]/published", params: { id: state.id } });
      else router.push({ pathname: "/portal/homes/[id]", params: { id: state.id } });
      router.refresh();
    } else summaryRef.current?.focus();
  }, [state, router]);

  const set = <K extends keyof ListingFormValues>(k: K, v: ListingFormValues[K]) => setValues((s) => ({ ...s, [k]: v }));
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => () => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));
  const serverErrors = state && !state.ok ? state.errors : {};
  // Field-level checks on blur, the same rules the server applies, so a typo
  // is caught where it happens instead of in the summary after submit.
  const clientErrors = useMemo(() => inlineErrors(values), [values]);
  const errors: Record<string, string> = { ...serverErrors };
  for (const [k, v] of Object.entries(clientErrors)) if (touched[k]) errors[k] = v;
  const err = (k: string) => {
    const e = errors[k];
    if (!e) return undefined;
    if (e === "invalidNumber") return t("invalidNumber");
    if (e === "invalidUrl") return t("invalidUrl");
    if (e === "invalidDate") return t("invalidDate");
    if (e === "invalidImage") return t("imagesInvalid");
    return t("fieldRequired");
  };
  const errorCount = Object.keys(errors).length;
  const num = (s: string) => {
    const n = Number(s.replace(/\s/g, "").replace(",", "."));
    return s && Number.isFinite(n) && n > 0 ? n : null;
  };
  const muni = municipalities.find((m) => m.id === values.municipalityId);
  const previewImages = [...images.filter((i) => !removed.includes(i.id)).map((i) => i.url), ...pendingFiles.map((f) => URL.createObjectURL(f))];
  const checks = {
    core: !!(num(values.rentMonthly) && num(values.rooms) && num(values.sizeSqm)),
    apply: values.applyRoute === "url" ? /^https?:\/\//.test(values.applicationUrl) : values.applicationContact.trim().length > 0,
    queue: values.queueRequirement !== "unknown",
    photo: previewImages.length > 0,
  };
  const segments: Segment[] = ["none", "student", "youth", "senior", "accessible"];
  const segLabel = (s: Segment) => (s === "none" ? t("segmentNone") : locale === "sv" ? { student: "Studentbostad", youth: "Ungdom", senior: "Senior", accessible: "Tillgänglighetsanpassad" }[s] : { student: "Student housing", youth: "Youth housing", senior: "Senior housing", accessible: "Accessible housing" }[s]);

  return (
    <form action={formAction} noValidate className="grid gap-6 lg:grid-cols-[1fr_350px]">
      <div className="flex flex-col gap-6">
        {errorCount ? (
          <div ref={summaryRef} tabIndex={-1}>
            <ValidationSummary title={t("validationTitle", { count: errorCount })} items={Object.keys(errors).map((k) => `${labelFor(k, t)}: ${err(k)}`)} />
          </div>
        ) : null}

        <Card as="section" className="p-6">
          <h2 className="text-h3">{t("sectionAddress")}</h2>
          <p className="mt-1 text-[13.5px] text-muted">{t("sectionAddressNote")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label={t("street")} name="address" onBlur={touch("address")} value={values.address} onChange={(e) => set("address", e.target.value)} error={err("address")} required wrapperClassName="sm:col-span-2" />
            <Input label={t("postcode")} name="postcode" value={values.postcode} onChange={(e) => set("postcode", e.target.value)} inputMode="numeric" autoComplete="postal-code" />
            <Select label={t("municipality")} name="municipalityId" onBlur={touch("municipalityId")} value={values.municipalityId} onChange={(e) => set("municipalityId", e.target.value)} error={err("municipalityId")} required>
              <option value="">{t("municipalityPlaceholder")}</option>
              {municipalities.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
            <Input label={t("area")} name="areaName" value={values.areaName} onChange={(e) => set("areaName", e.target.value)} hint={t("areaHint")} wrapperClassName="sm:col-span-2" />
          </div>
        </Card>

        <Card as="section" className="p-6">
          <h2 className="text-h3">{t("sectionHome")}</h2>
          <p className="mt-1 text-[13.5px] text-muted">{t("sectionHomeNote")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label={t("rent")} name="rentMonthly" onBlur={touch("rentMonthly")} value={values.rentMonthly} onChange={(e) => set("rentMonthly", e.target.value)} suffix={t("rentUnit")} hint={t("rentHint")} error={err("rentMonthly")} inputMode="numeric" required />
            <Input label={t("rooms")} name="rooms" onBlur={touch("rooms")} value={values.rooms} onChange={(e) => set("rooms", e.target.value)} suffix={t("roomsUnit")} error={err("rooms")} inputMode="decimal" required />
            <Input label={t("size")} name="sizeSqm" onBlur={touch("sizeSqm")} value={values.sizeSqm} onChange={(e) => set("sizeSqm", e.target.value)} suffix={t("sizeUnit")} error={err("sizeSqm")} inputMode="decimal" required />
            <Input label={t("floor")} name="floor" onBlur={touch("floor")} value={values.floor} onChange={(e) => set("floor", e.target.value)} error={err("floor")} inputMode="numeric" optional={tc("optional")} />
          </div>
        </Card>

        <Card as="section" className="p-6">
          <h2 className="text-h3">{t("sectionContract")}</h2>
          <p className="mt-1 text-[13.5px] text-muted">{t("sectionContractNote")}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label={t("contractType")} value={t("contractFirst")} readOnly name="contractType" />
            <Input label={t("moveIn")} name="moveInDate" type="date" onBlur={touch("moveInDate")} value={values.moveInDate} onChange={(e) => set("moveInDate", e.target.value)} error={err("moveInDate")} optional={tc("optional")} />
            <Input label={t("deadline")} name="applicationDeadline" type="date" onBlur={touch("applicationDeadline")} value={values.applicationDeadline} onChange={(e) => set("applicationDeadline", e.target.value)} hint={t("deadlineHint")} error={err("applicationDeadline")} optional={tc("optional")} />
            <Select label={t("segment")} name="segment" value={values.segment} onChange={(e) => set("segment", e.target.value as Segment)} hint={t("segmentHint")}>
              {segments.map((s) => (
                <option key={s} value={s}>
                  {segLabel(s)}
                </option>
              ))}
            </Select>
            <Textarea label={t("description")} name="description" value={values.description} onChange={(e) => set("description", e.target.value)} hint={t("descriptionHint")} optional={tc("optional")} />
          </div>
        </Card>

        <Card as="section" className="p-6">
          <Fieldset legend={t("queueTitle")} hint={t("queueNote")}>
            {(["none", "queue", "points", "unknown"] as const).map((q) => (
              <Radio key={q} name="queueRequirement" value={q} checked={values.queueRequirement === q} onChange={() => set("queueRequirement", q)} label={t(q === "none" ? "queueNone" : q === "queue" ? "queueRequired" : q === "points" ? "queuePoints" : "queueUnknown")} />
            ))}
          </Fieldset>
        </Card>

        <Card as="section" className="p-6">
          <Fieldset legend={t("applyTitle")} hint={t("applyNote")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <RadioBox name="applyRoute" value="url" checked={values.applyRoute === "url"} onChange={() => set("applyRoute", "url")} label={t("applyLink")} description={t("applyLinkBody")} />
              <RadioBox name="applyRoute" value="contact" checked={values.applyRoute === "contact"} onChange={() => set("applyRoute", "contact")} label={t("applyContact")} description={t("applyContactBody")} />
            </div>
            <div className="mt-4">
              {values.applyRoute === "url" ? (
                <Input label={t("applyUrlLabel")} name="applicationUrl" onBlur={touch("applicationUrl")} value={values.applicationUrl} onChange={(e) => set("applicationUrl", e.target.value)} error={err("applicationUrl")} inputMode="url" placeholder="https://" className="font-mono text-[14px]" />
              ) : (
                <Input label={t("applyContactLabel")} name="applicationContact" onBlur={touch("applicationContact")} value={values.applicationContact} onChange={(e) => set("applicationContact", e.target.value)} error={err("applicationContact")} />
              )}
            </div>
          </Fieldset>
        </Card>

        <Card as="section" className="p-6">
          <h2 className="text-h3">{t("imagesTitle")}</h2>
          <p className="mt-1 text-[13.5px] text-muted">{t("imagesNote")}</p>
          {err("images") ? <p className="mt-2 text-meta font-[600] text-error-text">{err("images")}</p> : null}
          <div
            className="mt-4 flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-line-strong bg-bg p-6 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              setPendingFiles((f) => [...f, ...Array.from(e.dataTransfer.files)]);
            }}
          >
            <p className="font-[650]">{t("dropTitle")}</p>
            <p className="text-meta text-muted">{t("dropHint")}</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" id="images-input" onChange={(e) => setPendingFiles((f) => [...f, ...Array.from(e.target.files ?? [])])} />
            <label htmlFor="images-input" className="mt-1 inline-flex min-h-touch cursor-pointer items-center rounded-md border border-line-strong bg-surface px-4 text-[14px] font-[650] hover:bg-bg">
              {t("dropCta")}
            </label>
          </div>
          {images.length || pendingFiles.length ? (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images
                .filter((i) => !removed.includes(i.id))
                .map((i) => (
                  <li key={i.id} className="relative">
                    <span className="relative block h-24 w-full overflow-hidden rounded">
                      <Image src={i.url} alt="" fill sizes="200px" className="object-cover" />
                    </span>
                    <button type="button" onClick={() => setRemoved((r) => [...r, i.id])} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-[16px] shadow" aria-label={t("removeImage")}>
                      ×
                    </button>
                  </li>
                ))}
              {pendingFiles.map((f, idx) => (
                <li key={`${f.name}-${idx}`} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt="" className="h-24 w-full rounded object-cover" />
                  <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, i) => i !== idx))} className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 text-[16px] shadow" aria-label={t("removeImage")}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <Card className="p-5">
          <h2 className="text-h3">{t("previewTitle")}</h2>
          <div className="mt-3">
            <CardPreview
              data={{
                address: values.address,
                areaName: values.areaName || null,
                municipalityName: muni?.label ?? "",
                rentMonthly: num(values.rentMonthly),
                rooms: num(values.rooms),
                sizeSqm: num(values.sizeSqm),
                imageUrl: previewImages[0] ?? null,
                landlordName,
                applicationDeadline: values.applicationDeadline || null,
                queueRequirement: values.queueRequirement,
                segment: values.segment,
              }}
            />
          </div>
          <p className="mt-2 text-meta text-muted">{t("previewNote")}</p>
        </Card>
        <Card className="p-5">
          <h2 className="text-h3">{t("checklistTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-2 text-[14px]">
            {[
              [checks.core, t("checkCore")],
              [checks.apply, t("checkApply")],
              [checks.queue, t("checkQueue")],
              [checks.photo, checks.photo ? t("checkPhotoDone") : t("checkPhoto")],
            ].map(([ok, label], i) => (
              <li key={i} className="flex items-center gap-2">
                <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${ok ? "bg-success text-white" : "border border-line-strong text-muted"}`}>
                  {ok ? icons.check : "–"}
                </span>
                <span className={ok ? "" : "text-muted"}>{label as string}</span>
                <span className="sr-only">{ok ? tc("yes") : tc("no")}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            {canPublish && status !== "active" ? (
              <Button type="submit" size="lg" loading={pending && mode === "publish"} onClick={() => setMode("publish")}>
                {t("publish")}
              </Button>
            ) : null}
            <Button type="submit" size="md" variant={status === "active" ? "primary" : "secondary"} loading={pending && mode === "draft"} onClick={() => setMode("draft")}>
              {status === "active" ? t("saveChanges") : t("saveDraft")}
            </Button>
            <p className="text-meta text-muted">{canPublish ? t("publishNote") : t("editorNote")}</p>
          </div>
        </Card>
      </aside>
    </form>
  );
}

function labelFor(k: string, t: ReturnType<typeof useTranslations<"portal.add">>) {
  const map = {
    address: "street",
    municipalityId: "municipality",
    rentMonthly: "rent",
    rooms: "rooms",
    sizeSqm: "size",
    floor: "floor",
    moveInDate: "moveIn",
    applicationDeadline: "deadline",
    applicationUrl: "applyUrlLabel",
    applicationContact: "applyContactLabel",
    images: "imagesTitle",
  } as const;
  return k in map ? t(map[k as keyof typeof map]) : k;
}

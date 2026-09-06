"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Checkbox, Fieldset, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/dialog";
import { FilterChip, icons } from "@/components/ui/misc";
import { formatNumber, formatSek, stockholmDate } from "@/lib/format";
import { useSearchTransition } from "./search-transition";
import {
  activeFilterCount,
  QUEUE_FILTERS,
  RENT_MAX,
  RENT_MIN,
  RENT_STEP,
  SEGMENT_FILTERS,
  SORTS,
  toQuery,
  type SearchFilters,
  type Sort,
} from "@/lib/search-params";

export type LandlordFacet = { slug: string; name: string; count: number };

type Props = {
  filters: SearchFilters;
  landlords: LandlordFacet[];
  total: number;
};

function useFilterNavigation(filters: SearchFilters) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const { pending, start: startTransition } = useSearchTransition();

  function apply(next: Partial<SearchFilters>, resetPage = true) {
    const merged = { ...filters, ...next, page: resetPage ? 1 : (next.page ?? filters.page) };
    startTransition(() => {
      router.replace({ pathname: pathname as never, params: params as never, query: toQuery(merged) } as never, { scroll: false });
    });
  }
  return { apply, pending };
}

export function FilterPanel({ filters, landlords, total, onApplied }: Props & { onApplied?: () => void }) {
  const t = useTranslations("filters");
  const tr = useTranslations("results");
  const locale = useLocale() as Locale;
  const { apply } = useFilterNavigation(filters);
  const [moreOpen, setMoreOpen] = useState(Boolean(filters.moveInBefore || filters.segment.length));
  const rentId = useId();
  const sizeMinId = useId();
  const sizeMaxId = useId();

  const maxRent = filters.maxRent ?? RENT_MAX;
  const [rentInput, setRentInput] = useState(String(maxRent));
  useEffect(() => setRentInput(String(filters.maxRent ?? RENT_MAX)), [filters.maxRent]);
  const rentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function commitRent(value: number) {
    const v = Math.min(RENT_MAX, Math.max(RENT_MIN, value));
    apply({ maxRent: v >= RENT_MAX ? undefined : v });
  }
  function onRentInput(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setRentInput(digits);
    if (rentTimer.current) clearTimeout(rentTimer.current);
    const n = parseInt(digits, 10);
    if (!Number.isNaN(n) && n > 0) rentTimer.current = setTimeout(() => commitRent(n), 500);
  }

  function toggleRoom(r: number) {
    const set = new Set(filters.rooms);
    if (set.has(r)) set.delete(r);
    else set.add(r);
    apply({ rooms: [...set].sort() });
  }
  function toggleIn<T extends string>(key: "queue" | "landlord" | "segment", v: T) {
    const set = new Set<string>(filters[key] as string[]);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    apply({ [key]: [...set] } as never);
  }

  const [sizeMin, setSizeMin] = useState(filters.sizeMin ? String(filters.sizeMin) : "");
  const [sizeMax, setSizeMax] = useState(filters.sizeMax ? String(filters.sizeMax) : "");
  useEffect(() => {
    setSizeMin(filters.sizeMin ? String(filters.sizeMin) : "");
    setSizeMax(filters.sizeMax ? String(filters.sizeMax) : "");
  }, [filters.sizeMin, filters.sizeMax]);
  function commitSize() {
    const min = parseInt(sizeMin, 10);
    const max = parseInt(sizeMax, 10);
    apply({ sizeMin: Number.isNaN(min) || min <= 0 ? undefined : min, sizeMax: Number.isNaN(max) || max <= 0 ? undefined : max });
  }

  const roomLabel = (r: number) => t("roomsOption", { rooms: r });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">{t("title")}</h2>
        <button type="button" onClick={() => apply({ maxRent: undefined, rooms: [], sizeMin: undefined, sizeMax: undefined, queue: [], landlord: [], segment: [], moveInBefore: undefined })} className="min-h-touch px-2 text-[14px] font-[600] text-primary hover:underline">
          {t("clear")}
        </button>
      </div>

      <div>
        <label htmlFor={rentId} className="text-label font-[650]">
          {t("maxRent")}
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            id={rentId}
            inputMode="numeric"
            value={maxRent >= RENT_MAX && rentInput === String(RENT_MAX) ? "" : formatNumber(locale, parseInt(rentInput || "0", 10) || 0)}
            placeholder={t("noLimit")}
            onChange={(e) => onRentInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(rentInput, 10);
              if (!Number.isNaN(n) && n > 0) commitRent(n);
            }}
            className="min-h-touch w-full rounded-md border border-line-strong bg-surface px-3 tabular focus:border-ink focus:outline-none"
          />
          <span className="shrink-0 text-[13.5px] text-muted">{t("perMonth")}</span>
        </div>
        <input
          type="range"
          min={RENT_MIN}
          max={RENT_MAX}
          step={RENT_STEP}
          value={maxRent}
          aria-label={t("maxRent")}
          aria-valuetext={maxRent >= RENT_MAX ? t("noLimit") : formatSek(locale, maxRent)}
          onChange={(e) => setRentInput(e.target.value)}
          onPointerUp={(e) => commitRent(parseInt((e.target as HTMLInputElement).value, 10))}
          onKeyUp={(e) => commitRent(parseInt((e.target as HTMLInputElement).value, 10))}
          className="mt-3 w-full accent-primary"
        />
        <div className="flex justify-between text-meta text-muted tabular">
          <span>{formatNumber(locale, RENT_MIN)}</span>
          <span>{formatNumber(locale, RENT_MAX)}+</span>
        </div>
      </div>

      <Fieldset legend={t("rooms")}>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((r) => {
            const on = filters.rooms.includes(r);
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={() => toggleRoom(r)}
                className={`min-h-touch rounded-md border px-2 text-[13.5px] font-[650] ${on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-bg"}`}
              >
                {roomLabel(r)}
              </button>
            );
          })}
        </div>
      </Fieldset>

      <Fieldset legend={t("size")}>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={sizeMinId}>
            {t("min")}
          </label>
          <input id={sizeMinId} inputMode="numeric" placeholder={t("min")} value={sizeMin} onChange={(e) => setSizeMin(e.target.value.replace(/\D/g, ""))} onBlur={commitSize} className="min-h-touch w-full rounded-md border border-line-strong bg-surface px-3 tabular focus:border-ink focus:outline-none" />
          <span aria-hidden="true" className="text-muted">–</span>
          <label className="sr-only" htmlFor={sizeMaxId}>
            {t("max")}
          </label>
          <input id={sizeMaxId} inputMode="numeric" placeholder={t("max")} value={sizeMax} onChange={(e) => setSizeMax(e.target.value.replace(/\D/g, ""))} onBlur={commitSize} className="min-h-touch w-full rounded-md border border-line-strong bg-surface px-3 tabular focus:border-ink focus:outline-none" />
          <span className="shrink-0 text-[13.5px] text-muted">m²</span>
        </div>
      </Fieldset>

      <Fieldset legend={t("queue")}>
        {QUEUE_FILTERS.map((q) => (
          <Checkbox key={q} label={t(q === "none" ? "queueNone" : q === "queue" ? "queueRequired" : "queueUnknown")} checked={filters.queue.includes(q)} onChange={() => toggleIn("queue", q)} />
        ))}
      </Fieldset>

      {landlords.length ? (
        <Fieldset legend={t("landlord")}>
          {landlords.map((l) => (
            <Checkbox key={l.slug} label={l.name} count={l.count} checked={filters.landlord.includes(l.slug)} onChange={() => toggleIn("landlord", l.slug)} />
          ))}
        </Fieldset>
      ) : null}

      <div>
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex min-h-touch items-center gap-1.5 text-[14px] font-[650] text-ink">
          {moreOpen ? t("fewer") : t("more")}
          <span className={`transition-transform ${moreOpen ? "rotate-180" : ""}`}>{icons.chevronDown}</span>
        </button>
        {moreOpen ? (
          <div className="mt-3 flex flex-col gap-5">
            <Select label={t("moveIn")} value={filters.moveInBefore ?? ""} onChange={(e) => apply({ moveInBefore: e.target.value || undefined })}>
              <option value="">{t("anyTime")}</option>
              {[1, 2, 3, 6].map((months) => {
                const d = new Date();
                d.setMonth(d.getMonth() + months);
                const iso = stockholmDate(d);
                return (
                  <option key={iso} value={iso}>
                    {t("moveInBefore", { date: new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : "en-GB", { month: "long", year: "numeric" }).format(d) })}
                  </option>
                );
              })}
            </Select>
            <Fieldset legend={t("segment")}>
              <div className="flex flex-wrap gap-1.5">
                {SEGMENT_FILTERS.map((s) => {
                  const on = filters.segment.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleIn("segment", s)}
                      className={`min-h-touch rounded-full border px-3.5 text-[13.5px] font-[650] ${on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-bg"}`}
                    >
                      {t(`segment${s[0].toUpperCase()}${s.slice(1)}` as never)}
                    </button>
                  );
                })}
              </div>
            </Fieldset>
          </div>
        ) : null}
      </div>

      {onApplied ? (
        <div className="sticky bottom-0 -mx-5 -mb-4 flex gap-2 border-t border-line bg-surface px-5 py-3">
          <Button variant="secondary" className="flex-1" onClick={() => apply({ maxRent: undefined, rooms: [], sizeMin: undefined, sizeMax: undefined, queue: [], landlord: [], segment: [], moveInBefore: undefined })}>
            {t("clearShort")}
          </Button>
          <Button className="flex-[2]" onClick={onApplied}>
            {tr("showN", { count: total })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ActiveChips({ filters, landlords }: { filters: SearchFilters; landlords: LandlordFacet[] }) {
  const t = useTranslations("filters");
  const locale = useLocale() as Locale;
  const { apply } = useFilterNavigation(filters);
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];

  if (filters.maxRent && filters.maxRent < RENT_MAX) {
    const label = t("maxRentChip", { rent: `${formatSek(locale, filters.maxRent)}/${locale === "sv" ? "mån" : "month"}` });
    chips.push({ key: "rent", label, remove: () => apply({ maxRent: undefined }) });
  }
  for (const r of filters.rooms) chips.push({ key: `rooms-${r}`, label: t("roomsOption", { rooms: r }), remove: () => apply({ rooms: filters.rooms.filter((x) => x !== r) }) });
  if (filters.sizeMin || filters.sizeMax) {
    const label = filters.sizeMin && filters.sizeMax ? t("sizeChip", { min: filters.sizeMin, max: filters.sizeMax }) : filters.sizeMin ? t("sizeMinChip", { min: filters.sizeMin }) : t("sizeMaxChip", { max: filters.sizeMax ?? 0 });
    chips.push({ key: "size", label, remove: () => apply({ sizeMin: undefined, sizeMax: undefined }) });
  }
  for (const q of filters.queue) chips.push({ key: `q-${q}`, label: t(q === "none" ? "queueNone" : q === "queue" ? "queueRequired" : "queueUnknown"), remove: () => apply({ queue: filters.queue.filter((x) => x !== q) }) });
  for (const l of filters.landlord) chips.push({ key: `l-${l}`, label: landlords.find((x) => x.slug === l)?.name ?? l, remove: () => apply({ landlord: filters.landlord.filter((x) => x !== l) }) });
  for (const s of filters.segment) chips.push({ key: `s-${s}`, label: t(`segment${s[0].toUpperCase()}${s.slice(1)}` as never), remove: () => apply({ segment: filters.segment.filter((x) => x !== s) }) });
  if (filters.moveInBefore) chips.push({ key: "movein", label: t("moveInBefore", { date: filters.moveInBefore }), remove: () => apply({ moveInBefore: undefined }) });

  if (!chips.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <li key={c.key} className="list-none">
          <FilterChip label={c.label} onRemove={c.remove} removeLabel={t("removeFilter", { label: c.label })} />
        </li>
      ))}
    </ul>
  );
}

export function SortSelect({ filters }: { filters: SearchFilters }) {
  const t = useTranslations("results");
  const ts = useTranslations("sorts");
  const { apply } = useFilterNavigation(filters);
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="shrink-0 text-[13.5px] text-muted">
        {t("sortBy")}
      </label>
      <Select id="sort" label={t("sortBy")} hideLabel value={filters.sort} onChange={(e) => apply({ sort: e.target.value as Sort })} className="min-h-10 py-0 text-[14px]">
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {ts(s)}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Mobile filter button + bottom sheet. */
export function MobileFilters({ filters, landlords, total }: Props) {
  const t = useTranslations("results");
  const tf = useTranslations("filters");
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-touch items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-[650] text-white">
        {icons.funnel}
        {t("filterButton")}
        {count ? (
          <span className="rounded-full bg-primary px-1.5 text-[12px] leading-5" aria-label={t("activeFilters", { count })}>
            {count}
          </span>
        ) : null}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tf("title")} variant="sheet">
        <FilterPanel filters={filters} landlords={landlords} total={total} onApplied={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

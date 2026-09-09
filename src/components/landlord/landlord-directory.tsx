"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Select, inputClasses } from "@/components/ui/form";
import { StatusPill } from "@/components/ui/badge";
import { FilterChip, icons } from "@/components/ui/misc";
import type { LandlordDirectoryEntry } from "@/lib/queries/landlords";

type Municipality = { id: string; name: string };
type TypeFilter = LandlordDirectoryEntry["type"] | "";
type Monitored = "" | "yes" | "no";

const TYPE_KEYS = { municipal: "typeMunicipal", private: "typePrivate", agency: "typeAgency", foundation: "typeFoundation" } as const;
const TYPES = Object.keys(TYPE_KEYS) as Array<keyof typeof TYPE_KEYS>;

/** Accent- and case-insensitive: "forvaltaren" finds Förvaltaren. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/**
 * The landlord directory, filtered in the browser. The list is small and the
 * page is prerendered, so every landlord ships with it and no request is made
 * to narrow it; without JavaScript the full list is what shows. The filters
 * mirror into the URL so a narrowed view can be shared, and are read back from
 * it on load.
 */
export function LandlordDirectory({ entries, municipalities }: { entries: LandlordDirectoryEntry[]; municipalities: Municipality[] }) {
  const t = useTranslations("landlord");
  const searchId = useId();
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>("");
  const [muni, setMuni] = useState("");
  const [monitored, setMonitored] = useState<Monitored>("");

  // URL → state on load, state → URL on change. replaceState keeps the back
  // button for leaving the page, not for undoing each keystroke.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") ?? "");
    const ty = p.get("type");
    if (ty && TYPES.includes(ty as keyof typeof TYPE_KEYS)) setType(ty as TypeFilter);
    const m = p.get("muni");
    if (m && municipalities.some((x) => x.id === m)) setMuni(m);
    const mon = p.get("monitored");
    if (mon === "yes" || mon === "no") setMonitored(mon);
  }, [municipalities]);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (type) p.set("type", type);
    if (muni) p.set("muni", muni);
    if (monitored) p.set("monitored", monitored);
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [q, type, muni, monitored]);

  const shown = useMemo(() => {
    const needle = fold(q.trim());
    return entries.filter((e) => {
      if (needle && !fold(e.name).includes(needle)) return false;
      if (type && e.type !== type) return false;
      if (muni && !e.municipalityIds.includes(muni)) return false;
      if (monitored === "yes" && !e.isMonitored) return false;
      if (monitored === "no" && e.isMonitored) return false;
      return true;
    });
  }, [entries, q, type, muni, monitored]);

  const muniName = (id: string) => municipalities.find((m) => m.id === id)?.name ?? id;
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (type) chips.push({ key: "type", label: t(TYPE_KEYS[type]), clear: () => setType("") });
  if (muni) chips.push({ key: "muni", label: muniName(muni), clear: () => setMuni("") });
  if (monitored) chips.push({ key: "mon", label: monitored === "yes" ? t("monitored") : t("notMonitoredShort"), clear: () => setMonitored("") });
  const anyFilter = Boolean(q || chips.length);

  return (
    <div className="mt-8">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className="relative flex items-center">
          <span className="sr-only">{t("searchLabel")}</span>
          <span className="pointer-events-none absolute left-3.5 text-muted">{icons.search}</span>
          <input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} autoComplete="off" className={`${inputClasses} pl-11`} />
        </label>
        <Select label={t("filterMunicipality")} hideLabel value={muni} onChange={(e) => setMuni(e.target.value)} className="min-h-touch py-0 text-[14px]">
          <option value="">{t("anyMunicipality")}</option>
          {municipalities.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select label={t("filterType")} hideLabel value={type} onChange={(e) => setType(e.target.value as TypeFilter)} className="min-h-touch py-0 text-[14px]">
          <option value="">{t("anyType")}</option>
          {TYPES.map((k) => (
            <option key={k} value={k}>
              {t(TYPE_KEYS[k])}
            </option>
          ))}
        </Select>
        <Select label={t("filterMonitored")} hideLabel value={monitored} onChange={(e) => setMonitored(e.target.value as Monitored)} className="min-h-touch py-0 text-[14px]">
          <option value="">{t("anyMonitored")}</option>
          <option value="yes">{t("monitored")}</option>
          <option value="no">{t("notMonitoredShort")}</option>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-[13.5px] text-muted" aria-live="polite">
          {t("showingCount", { shown: shown.length, total: entries.length })}
        </p>
        {chips.map((c) => (
          <FilterChip key={c.key} label={c.label} onRemove={c.clear} removeLabel={t("removeFilter", { label: c.label })} />
        ))}
        {anyFilter ? (
          <button type="button" onClick={() => { setQ(""); setType(""); setMuni(""); setMonitored(""); }} className="min-h-9 px-2 text-[13.5px] font-[600] text-primary hover:underline">
            {t("clearFilters")}
          </button>
        ) : null}
      </div>

      {shown.length ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((l) => (
            <li key={l.id} className="min-w-0 list-none">
              <Link href={{ pathname: "/landlords/[slug]", params: { slug: l.slug } }} className="flex h-full flex-col gap-2 rounded-md border border-line bg-surface p-4 text-ink hover:border-line-strong hover:no-underline">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 text-[15px] font-[650] leading-snug">{l.name}</span>
                  <StatusPill tone={l.isMonitored ? "success" : "quiet"}>{l.isMonitored ? t("monitored") : t("notMonitoredShort")}</StatusPill>
                </span>
                <span className="text-meta text-muted">
                  {t(TYPE_KEYS[l.type])}
                  {l.isMonitored ? ` · ${l.count} ${t("statListings").toLowerCase()}` : ""}
                  {l.municipalityIds.length ? ` · ${l.municipalityIds.length === 1 ? muniName(l.municipalityIds[0]) : t("municipalityCount", { count: l.municipalityIds.length })}` : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-md border border-line bg-surface px-5 py-8 text-center text-ink-2">{t("noMatches")}</p>
      )}
    </div>
  );
}

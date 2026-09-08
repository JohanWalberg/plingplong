"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { icons } from "@/components/ui/misc";
import type { SuggestItem } from "@/app/api/suggest/route";

/**
 * The search field with place suggestions as you type. Follows the combobox
 * pattern: arrow keys move through the list, Enter picks the active option or
 * submits the plain form when nothing is active, Escape closes. Without JS the
 * form still submits `q` to the results page.
 *
 * `target` decides where a pick lands. On the map it must stay on the map:
 * sending the visitor to the list was the whole reason searching there felt
 * broken. `keepQuery` carries the filters already in the URL across the jump.
 */
export function SearchInput({
  locale,
  defaultValue = "",
  placeholder,
  label,
  className,
  target = "list",
  keepQuery,
}: {
  locale: Locale;
  defaultValue?: string;
  placeholder: string;
  label: string;
  className: string;
  target?: "list" | "map";
  keepQuery?: Record<string, string>;
}) {
  const t = useTranslations("home");
  const tc = useTranslations("common");
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [items, setItems] = useState<SuggestItem[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abort = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) clearTimeout(timer.current);
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}&locale=${locale}`, { signal: ctrl.signal });
        if (!res.ok) return;
        const data = (await res.json()) as SuggestItem[];
        setItems(data);
        setOpen(data.length > 0);
        setActive(-1);
      } catch {
        // aborted or offline: keep whatever is shown
      }
    }, 150);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, locale]);

  function choose(item: SuggestItem) {
    setOpen(false);
    setValue(item.name);
    if (target !== "map") {
      router.push(item.href);
      return;
    }
    // The place replaces any bbox: the visitor asked for a place, not for the
    // rectangle they happened to be looking at.
    const [path, search] = item.mapHref.split("?");
    const params = new URLSearchParams(search);
    for (const [k, v] of Object.entries(keepQuery ?? {})) if (!params.has(k)) params.set(k, v);
    router.push(`${path}?${params.toString()}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative flex flex-1" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <label className="relative flex flex-1 items-center">
        <span className="sr-only">{label}</span>
        <span className="pointer-events-none absolute left-3.5 text-muted">{icons.search}</span>
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => {
            dirty.current = true;
            setValue(e.target.value);
          }}
          onFocus={() => items.length && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          className={className}
        />
      </label>
      <ul id={listId} role="listbox" aria-label={t("suggestionsLabel")} hidden={!open} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[320px] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-lg">
        {items.map((item, i) => (
          <li
            key={`${item.kind}-${item.href}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(item)}
            onMouseEnter={() => setActive(i)}
            className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2.5 text-[15px] ${i === active ? "bg-primary-subtle" : ""}`}
          >
            <span className="min-w-0">
              <span className="font-[650] text-ink">{item.name}</span>
              {item.detail ? <span className="ml-2 text-meta text-muted">{item.kind === "area" ? item.detail : item.detail}</span> : null}
            </span>
            <span className="shrink-0 text-meta text-muted tabular">{tc("resultsCount", { count: item.count })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

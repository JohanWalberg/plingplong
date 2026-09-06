"use client";

import { createContext, useContext, useTransition, type ReactNode, type TransitionStartFunction } from "react";
import { useTranslations } from "next-intl";

type Ctx = { pending: boolean; start: TransitionStartFunction };
const SearchTransitionContext = createContext<Ctx | null>(null);

/**
 * One transition shared by every filter control on the results page, so the
 * list can show that it is updating while the sidebar, chips and sort stay
 * interactive. Without the provider, controls fall back to their own
 * transition and nothing dims.
 */
export function SearchTransitionProvider({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  return <SearchTransitionContext.Provider value={{ pending, start }}>{children}</SearchTransitionContext.Provider>;
}

export function useSearchTransition(): Ctx {
  const ctx = useContext(SearchTransitionContext);
  const [pending, start] = useTransition();
  return ctx ?? { pending, start };
}

/** Wraps the result list: dims it and announces busy while a filter change is in flight. */
export function ResultsRegion({ children }: { children: ReactNode }) {
  const { pending } = useSearchTransition();
  const t = useTranslations("common");
  return (
    <div aria-busy={pending} className={`relative transition-opacity duration-200 ${pending ? "pointer-events-none opacity-50" : ""}`}>
      {pending ? (
        <>
          <span className="sr-only" role="status">
            {t("loading")}
          </span>
          <span aria-hidden="true" className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-primary-subtle">
            <span className="progress-sweep block h-full w-1/3 rounded-full bg-primary" />
          </span>
        </>
      ) : null}
      {children}
    </div>
  );
}

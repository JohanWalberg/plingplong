import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Card, Skeleton } from "./misc";
import { ListingCardSkeleton } from "@/components/listing/listing-card";

/**
 * Page-level loading states. Each mirrors the layout of the page it stands in
 * for, so the swap to real content does not move anything. The wrapper
 * announces "Loading…" to assistive tech once; the bars themselves are hidden.
 */
export function LoadingRegion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const t = useTranslations("common");
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{t("loading")}</span>
      {children}
    </div>
  );
}

function Lines({ n, widths }: { n: number; widths?: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} className={`h-4 ${widths?.[i % (widths.length || 1)] ?? "w-full"}`} />
      ))}
    </div>
  );
}

/** Filter column, heading, three result cards. Matches SearchPage. */
export function SearchResultsSkeleton() {
  return (
    <LoadingRegion className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[272px_1fr]">
      <div className="hidden lg:block">
        <Card className="flex flex-col gap-5 p-4">
          <Skeleton className="h-5 w-1/2" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </Card>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Breadcrumb, facts card, photo, two text cards and the sticky side card. Matches the listing page. */
export function ListingDetailSkeleton() {
  return (
    <LoadingRegion className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <Skeleton className="h-4 w-56" />
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_372px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card className="p-6 sm:p-8">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="mt-3 h-5 w-1/3" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-hairline pt-6 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </Card>
          <Skeleton className="h-[320px] w-full rounded-md" />
          <Card className="p-6 sm:p-8">
            <Skeleton className="h-6 w-40" />
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Lines n={4} widths={["w-full"]} />
              <Lines n={4} widths={["w-full"]} />
            </div>
            <Skeleton className="mt-6 h-4 w-24" />
            <div className="mt-3">
              <Lines n={3} widths={["w-full", "w-11/12", "w-2/3"]} />
            </div>
          </Card>
          <Card className="p-6 sm:p-8">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-3 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-2 h-9 w-40" />
            <Skeleton className="mt-4 h-6 w-32 rounded-full" />
            <div className="mt-5 flex items-center gap-3 border-t border-hairline pt-5">
              <Skeleton className="h-10 w-10" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3.5 w-16" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
            <Skeleton className="mt-5 h-12 w-full" />
            <Skeleton className="mt-3 h-10 w-full" />
          </Card>
          <Card className="p-6">
            <Skeleton className="h-4 w-1/2" />
            <div className="mt-3">
              <Lines n={3} widths={["w-full", "w-5/6", "w-2/3"]} />
            </div>
          </Card>
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Heading plus a grid of cards. Used by the municipality, landlord and coverage pages. */
export function CardGridSkeleton({ cards = 6, columns = "sm:grid-cols-2 lg:grid-cols-3" }: { cards?: number; columns?: string }) {
  return (
    <LoadingRegion className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className={`mt-8 grid gap-4 ${columns}`}>
        {Array.from({ length: cards }, (_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-3 h-4 w-1/2" />
            <Skeleton className="mt-2 h-4 w-1/3" />
          </Card>
        ))}
      </div>
    </LoadingRegion>
  );
}

/** Heading row, then the list column beside a map-sized block. Matches MapView. */
export function MapSkeleton() {
  return (
    <LoadingRegion>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid h-[calc(100dvh-140px)] min-h-[520px] grid-cols-1 lg:grid-cols-[360px_1fr]">
        <div className="hidden flex-col border-r border-line bg-surface lg:flex">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 border-b border-hairline px-4 py-3">
              <div className="flex justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          ))}
        </div>
        <Skeleton className="h-full w-full rounded-none" />
      </div>
    </LoadingRegion>
  );
}

/** Four KPI tiles and a table. Used inside the portal and admin shells. */
export function DashboardSkeleton({ kpis = 4, rows = 6, columns = 6 }: { kpis?: number; rows?: number; columns?: number }) {
  return (
    <LoadingRegion>
      {kpis > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: kpis }, (_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="mt-2 h-7 w-16" />
            </Card>
          ))}
        </div>
      ) : null}
      <Card className={`overflow-hidden ${kpis > 0 ? "mt-6" : ""}`}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex flex-col divide-y divide-hairline">
          <div className="flex gap-6 px-4 py-3">
            {Array.from({ length: columns }, (_, i) => (
              <Skeleton key={i} className="h-3.5 flex-1" />
            ))}
          </div>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex gap-6 px-4 py-3.5">
              {Array.from({ length: columns }, (_, c) => (
                <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-[40%]" : ""}`} />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </LoadingRegion>
  );
}

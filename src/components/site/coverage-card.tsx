import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/misc";

/** Coverage is always "monitored of known landlords", never a market share. */
export async function CoverageCard({ place, monitored, known }: { place: string; monitored: number; known: number }) {
  const t = await getTranslations("coverage");
  const pct = known ? Math.round((monitored / known) * 100) : 0;
  return (
    <Card as="section" className="p-5" aria-labelledby="coverage-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="coverage-title" className="text-h3">
          {t("title", { place })}
        </h2>
        <details className="relative">
          <summary className="flex h-touch w-touch cursor-pointer list-none items-center justify-center rounded-full border border-line-strong text-[14px] font-[700] text-muted hover:bg-bg" aria-label={t("toggle")}>
            ?
          </summary>
          <div className="absolute right-0 top-12 z-10 w-[min(80vw,320px)] rounded-md border-l-4 border-info bg-info-bg p-4 text-[14px] text-info-text shadow-md">{t("tooltip")}</div>
        </details>
      </div>
      {known === 0 ? (
        <p className="mt-3 text-[14px] text-muted">{t("noneKnown", { place })}</p>
      ) : (
        <>
          <dl className="mt-4 flex flex-col gap-2 text-[14.5px]">
            <div className="flex justify-between">
              <dt className="text-muted">{t("monitored")}</dt>
              <dd className="font-[700] tabular">{monitored}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">{t("known")}</dt>
              <dd className="font-[700] tabular">{known}</dd>
            </div>
          </dl>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-placeholder" role="img" aria-label={t("ratio", { monitored, known })}>
            <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-meta text-muted">{t("ratio", { monitored, known })}</p>
        </>
      )}
    </Card>
  );
}

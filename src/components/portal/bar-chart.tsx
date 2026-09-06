import { formatDateShort } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

export type ChartSeries = { key: string; label: string; color: string };
export type ChartRow = { day: string; values: Record<string, number> };

/**
 * Series colours, validated as a categorical palette (lightness band, chroma,
 * colour-vision separation, contrast on white). Fixed order: views, clicks,
 * saves. Text never wears these; only the marks and legend swatches do.
 */
export const SERIES_COLORS = { views: "#3a7bd0", clicks: "#a34a2a", saves: "#2c9a6a" } as const;

/**
 * Grouped daily bars, one group per day and one bar per series, with a
 * legend when there is more than one series, a native tooltip per bar and a
 * visually hidden table carrying the same numbers.
 */
export function BarChart({ rows, series, locale, label, tableCaption, dayLabel }: { rows: ChartRow[]; series: ChartSeries[]; locale: Locale; label: string; tableCaption: string; dayLabel: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => series.map((s) => r.values[s.key] ?? 0)));
  const n = Math.max(1, rows.length);
  const band = 100 / n;
  const gap = band * 0.08;
  const barW = (band - gap * (series.length + 1)) / series.length;
  const H = 40;
  return (
    <div>
      {series.length > 1 ? (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-meta text-muted" aria-hidden="true">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={label}>
        <line x1="0" y1={H} x2="100" y2={H} stroke="var(--color-border)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
        {rows.map((r, i) =>
          series.map((s, j) => {
            const v = r.values[s.key] ?? 0;
            const h = (v / max) * (H - 2);
            const x = i * band + gap + j * (barW + gap);
            const title = `${formatDateShort(locale, r.day)} · ${series.map((t) => `${t.label}: ${r.values[t.key] ?? 0}`).join(" · ")}`;
            return (
              <g key={`${r.day}-${s.key}`}>
                {/* Transparent hit area taller than the bar so hover works on small values. */}
                <rect x={x} y={0} width={barW} height={H} fill="transparent">
                  <title>{title}</title>
                </rect>
                <rect x={x} y={H - h} width={barW} height={h} fill={s.color} pointerEvents="none" />
              </g>
            );
          }),
        )}
      </svg>
      <div className="flex justify-between text-meta text-muted tabular" aria-hidden="true">
        {rows.filter((_, i) => i % Math.ceil(n / 7) === 0).map((r) => (
          <span key={r.day}>{formatDateShort(locale, r.day)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{dayLabel}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <td>{formatDateShort(locale, r.day)}</td>
              {series.map((s) => (
                <td key={s.key}>{r.values[s.key] ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

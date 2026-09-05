import { formatDateShort } from "@/lib/format";
import type { Locale } from "@/i18n/routing";

type Series = Array<{ day: string; value: number; secondary?: number }>;

/**
 * Simple accessible bar chart: SVG bars with an aria-label per bar and a
 * visually hidden table carrying the same numbers.
 */
export function BarChart({ series, locale, label, tableCaption, valueLabel, secondaryLabel, dayLabel }: { series: Series; locale: Locale; label: string; tableCaption: string; valueLabel: string; secondaryLabel?: string; dayLabel: string }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const maxIdx = series.reduce((best, s, i) => (s.value > series[best].value ? i : best), 0);
  const n = series.length;
  const w = 100 / n;
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={label}>
        {series.map((s, i) => {
          const h = (s.value / max) * 36;
          const h2 = s.secondary !== undefined ? (s.secondary / max) * 36 : 0;
          return (
            <g key={s.day}>
              <rect x={i * w + w * 0.15} y={40 - h} width={w * 0.7} height={h} fill={i === maxIdx ? "var(--color-primary)" : "var(--color-border-strong)"} rx="0.4">
                <title>{`${formatDateShort(locale, s.day)}: ${s.value}`}</title>
              </rect>
              {s.secondary !== undefined ? <rect x={i * w + w * 0.15} y={40 - h2} width={w * 0.7} height={h2} fill="var(--color-text)" rx="0.4" /> : null}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-meta text-muted tabular">
        {series.filter((_, i) => i % Math.ceil(n / 7) === 0).map((s) => (
          <span key={s.day}>{formatDateShort(locale, s.day)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{dayLabel}</th>
            <th scope="col">{valueLabel}</th>
            {secondaryLabel ? <th scope="col">{secondaryLabel}</th> : null}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.day}>
              <td>{formatDateShort(locale, s.day)}</td>
              <td>{s.value}</td>
              {secondaryLabel ? <td>{s.secondary ?? 0}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

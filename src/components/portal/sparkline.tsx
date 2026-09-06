/**
 * Tiny inline line for a table cell. Text carries the numbers (a label for
 * assistive tech and the total in the neighbouring column); the line only
 * shows the shape. Flat when every value is zero.
 */
export function Sparkline({ values, label, color = "#3a7bd0", width = 96, height = 24 }: { values: number[]; label: string; color?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const n = Math.max(2, values.length);
  const pts = values.map((v, i) => `${((i / (n - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  const last = values[values.length - 1] ?? 0;
  const [lx, ly] = (pts[pts.length - 1] ?? "0,0").split(",");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="block">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2" fill={color}>
        <title>{`${label}: ${last}`}</title>
      </circle>
    </svg>
  );
}

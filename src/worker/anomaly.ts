/**
 * Anomaly guard: if a run finds far fewer listings than the trailing median of
 * successful runs, flag the source for review instead of mass-removing.
 */
export const DROP_RATIO = 0.4; // found < 40% of median == a >60% drop
export const MIN_BASELINE = 5;

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function isAnomalousDrop(found: number, previousFound: number[]): { anomaly: boolean; baseline: number | null } {
  const baseline = median(previousFound);
  if (baseline === null || baseline < MIN_BASELINE) return { anomaly: false, baseline };
  return { anomaly: found < baseline * DROP_RATIO, baseline };
}

/**
 * Page numbers to show around the current page: always the first and last,
 * `around` pages on each side of the current one, and `null` where pages are
 * skipped. For 20 pages at page 6 with around=2: 1, null, 4, 5, 6, 7, 8, null, 20.
 */
export function pageWindow(page: number, pages: number, around = 2): Array<number | null> {
  if (pages <= 1) return [1];
  if (pages <= around * 2 + 3) return Array.from({ length: pages }, (_, i) => i + 1); // short enough to show every page
  const keep = new Set<number>([1, pages]);
  for (let p = page - around; p <= page + around; p++) if (p >= 1 && p <= pages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: Array<number | null> = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] === 2) out.push(sorted[i] - 1); // a single skipped page: show it instead of a gap
    else if (i > 0 && sorted[i] - sorted[i - 1] > 2) out.push(null);
    out.push(sorted[i]);
  }
  return out;
}

/** Typographic minus, never a hyphen, for negative figures. */
export const MINUS = '−';

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** AED million to one decimal with grouping, e.g. "1,234.5". */
export function aedm(n: number): string {
  const s = one.format(Math.abs(n));
  return n < 0 ? `${MINUS}${s}` : s;
}
/** AED million for prose, e.g. "AED 1,234.5 m". */
export const aedmLabel = (n: number) => `AED ${aedm(n)} m`;
/** A plain count. */
export const count = (n: number) => grouped.format(n);
/** Percent with one decimal. */
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
/** A score to one decimal, or a dash for none. */
export const score = (s: number | null) => (s == null ? '-' : s.toFixed(1));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Sep 2026" from an ISO date. Dates are calendar values; no timezone applies. */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}`;
}
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
}

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

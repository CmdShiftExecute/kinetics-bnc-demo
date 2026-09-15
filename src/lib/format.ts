/** Typographic minus, never a hyphen, for negative figures. */
export const MINUS = '−';

const grouped = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const two = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Source USD million to one decimal with grouping, e.g. "1,234.5". */
export function aedm(n: number): string {
  const s = one.format(Math.abs(n));
  return n < 0 ? `${MINUS}${s}` : s;
}
/** Source USD million for prose, e.g. "USD 1,234.5 m". */
export const aedmLabel = (n: number) => `USD ${aedm(n)} m`;

type AedScale = { divisor: number; compact: 'm' | 'bn' | 'tn'; word: 'million' | 'billion' | 'trillion'; digits: 1 | 2 };

/** Pick a readable display unit for a source value stored in USD million. */
function aedScale(n: number): AedScale {
  const value = Math.abs(n);
  if (value >= 1_000_000) return { divisor: 1_000_000, compact: 'tn', word: 'trillion', digits: 2 };
  if (value >= 1_000) return { divisor: 1_000, compact: 'bn', word: 'billion', digits: 1 };
  return { divisor: 1, compact: 'm', word: 'million', digits: 1 };
}

/** Compact adaptive USD value, for tables and charts: 53.7bn or 1.10tn. */
export function aedCompact(n: number): string {
  const scale = aedScale(n);
  const amount = (scale.digits === 2 ? two : one).format(Math.abs(n) / scale.divisor);
  return `${n < 0 ? MINUS : ''}${amount}${scale.compact}`;
}

/** Plain-English adaptive USD label, for headlines and prose. */
export function aedLabel(n: number): string {
  const scale = aedScale(n);
  const amount = (scale.digits === 2 ? two : one).format(Math.abs(n) / scale.divisor);
  return `${n < 0 ? MINUS : ''}USD ${amount} ${scale.word}`;
}
/** A plain count. */
export const count = (n: number) => grouped.format(n);
/** Percent with one decimal. */
export const pct = (n: number, d = 1) => `${n.toFixed(d)}%`;
/** A score to one decimal, or a dash for none. */
export const score = (s: number | null) => (s == null ? '-' : s.toFixed(1));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Sep 2026" from an ISO date. Dates are calendar values; no timezone applies. */
export function dateLabel(iso: string | null): string {
  if (!iso) return 'Not recorded';
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

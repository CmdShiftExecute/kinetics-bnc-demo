import { useState } from 'react';
import type { PointerEvent } from 'react';
import { count, cx, pct } from '../lib/format';
import { keyStep } from './charts';

/** The eleven buckets folded into four bands for a small stacked bar: won, active, waiting, closed. */
export const BANDS: { key: 'won' | 'active' | 'quiet' | 'closed'; label: string; codes: number[] }[] = [
  { key: 'won', label: 'Orders', codes: [0] },
  { key: 'active', label: 'Active', codes: [1, 2, 3, 5, 6] },
  { key: 'quiet', label: 'Waiting or quiet', codes: [7, 8, 9, 10] },
  { key: 'closed', label: 'Closed', codes: [4] },
];

export function bandCounts(funnel: number[]): number[] {
  return BANDS.map((b) => b.codes.reduce((a, c) => a + (funnel[c] ?? 0), 0));
}

/**
 * A small stacked bar of an engineer's activity mix, hover-driven with keyboard parity.
 * The readout names the band, its count and its share; the full eleven-bucket funnel
 * is on the engineer's page.
 */
export function MixBar({ funnel, id, width = 220 }: { funnel: number[]; id: string; width?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const bands = bandCounts(funnel);
  const total = bands.reduce((a, b) => a + b, 0);
  const h = 10;
  let x = 0;
  const segs = bands.map((n, i) => {
    const w = total ? (width * n) / total : 0;
    const s = { i, n, x, w };
    x += w;
    return s;
  });
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const i = segs.findIndex((s) => px >= s.x && px < s.x + s.w);
    setHover(i >= 0 ? i : null);
  };
  const hs = hover != null ? segs[hover] : undefined;
  const readout = hs ? `${BANDS[hs.i]!.label}: ${count(hs.n)} of ${count(total)}, ${pct(total ? (hs.n / total) * 100 : 0)}` : BANDS.map((b, i) => `${b.label} ${count(bands[i]!)}`).join(', ');
  return (
    <div className="mix">
      <svg id={id} className="chart mixbar" width={width} height={h} viewBox={`0 0 ${width} ${h}`} role="img" aria-label={`Activity mix. ${BANDS.map((b, i) => `${b.label}: ${count(bands[i]!)}`).join('. ')}.`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={(e) => keyStep(e, segs.length, hover, setHover)}>
        <rect x={0} y={0} width={width} height={h} fill="transparent" />
        {segs.map((s) => (
          <rect key={s.i} className={cx('mseg', BANDS[s.i]!.key, hover === s.i && 'mk-on')} x={s.x} y={0} width={Math.max(0, s.w - (s.i < segs.length - 1 ? 1 : 0))} height={h} />
        ))}
      </svg>
      <p className={cx('mix-read', hover != null && 'on')} aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

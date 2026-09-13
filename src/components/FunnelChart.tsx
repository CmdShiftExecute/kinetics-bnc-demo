import { useState } from 'react';
import type { PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BUCKETS } from '../../data/schema';
import { count, cx, pct } from '../lib/format';
import { keyStep, readboxAt } from './charts';
import { useWidth } from './useWidth';

/**
 * The activity funnel: one bar per bucket in priority order, highest priority at the
 * top, so the eye reads from orders down to silence. Pointing at a bar, or walking
 * bars with the arrow keys, reads out its count and share. Project closed is drawn in
 * hazard because it is the one bucket that is a loss.
 */
export function FunnelChart({ funnel, id, unit = 'pairs' }: { funnel: number[]; id: string; unit?: string }) {
  const { ref, width } = useWidth(800);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = width < 560 ? 150 : 250;
  const m = { left: labelW, right: 70, top: 6, bottom: 8 };
  const rowH = 22;
  const barH = 12;
  const plotW = Math.max(60, width - m.left - m.right);
  const total = funnel.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...funnel);
  const height = m.top + funnel.length * rowH + m.bottom;
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientY - r.top - m.top) / rowH);
    setHover(i >= 0 && i < funnel.length ? i : null);
  };
  const h = hover != null ? hover : null;
  const readout = h != null ? `${BUCKETS[h]}: ${count(funnel[h]!)} ${unit}, ${pct(total ? (funnel[h]! / total) * 100 : 0)}` : '';
  const box = h != null ? readboxAt(readout.toUpperCase(), m.left + Math.min(plotW - 40, (plotW * funnel[h]!) / max + 8), m.top + h * rowH - 2, width) : null;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg id={id} className="chart" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Activity funnel. ${BUCKETS.map((b, i) => `${b}: ${count(funnel[i]!)}`).join('. ')}.`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={(e) => keyStep(e, funnel.length, hover, setHover)}>
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {funnel.map((n, i) => {
          const label = BUCKETS[i]!;
          const short = width < 560 && label.length > 20 ? label.slice(0, 19) + '.' : label;
          return (
            <g key={label} transform={`translate(0 ${m.top + i * rowH})`}>
              {hover === i && <rect className="rowhi" x={0} y={0} width={width} height={rowH} />}
              <text x={m.left - 10} y={rowH / 2 + 4} textAnchor="end" className="ink">
                {short}
              </text>
              <motion.rect className={cx('fbar', i === 4 && 'hz', hover === i && 'mk-on')} x={m.left} y={(rowH - barH) / 2} width={Math.max(1, (plotW * n) / max)} height={barH} style={{ transformOrigin: `${m.left}px 0px` }} {...(reduce ? {} : { initial: { scaleX: 0 }, whileInView: { scaleX: 1 }, viewport: { once: true }, transition: { duration: 0.45, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] } })} />
              <text x={m.left + Math.max(1, (plotW * n) / max) + 6} y={rowH / 2 + 4} className="ink num-t">
                {count(n)}
              </text>
            </g>
          );
        })}
        {h != null && box && (
          <g className="readbox">
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
            <text x={box.x + 8} y={box.y + 15}>
              {readout.toUpperCase()}
            </text>
          </g>
        )}
      </svg>
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

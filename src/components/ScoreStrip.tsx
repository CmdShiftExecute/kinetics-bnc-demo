import { useState } from 'react';
import type { PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { gradeOf } from '../../data/rules';
import type { Vertical } from '../../data/schema';
import { cx, score } from '../lib/format';
import { keyStep } from './charts';
import { useWidth } from './useWidth';

/**
 * The ten vertical scores of one project as a bar strip: one column per vertical,
 * height by score out of 8, the grade under it, the owning vertical outlined in ink,
 * a hand-adjusted score marked. Drawn at the full width of its section (a narrow
 * viewport keeps a 760px floor and scrolls: ten columns of 76px, enough for the
 * longest single word, DISTRIBUTION, at 10px mono). A name breaks into one word
 * per line past twelve characters, so no label runs past the strip's left edge;
 * "ELECTRICAL DISTRIBUTION" centred on the first column used to start 19px outside
 * it, measured 16 Sep 2026. Hover-driven with keyboard parity.
 */
/** "Pumps and Water" reads PUMPS AND / WATER; a part past twelve characters breaks at its spaces. */
const labelLines = (name: string): string[] =>
  name
    .toUpperCase()
    .split(' AND ')
    .flatMap((part, i, all) => {
      const line = i < all.length - 1 ? `${part} AND` : part;
      return line.length > 12 ? line.split(' ') : [line];
    });

export function ScoreStrip({ verticals, scores, adjusted, owner, id }: { verticals: Vertical[]; scores: (number | null)[]; adjusted: number[]; owner: number | null; id: string }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const { ref, width: measured } = useWidth(1000, 760);
  const width = Math.max(760, measured);
  const colW = width / verticals.length;
  const barW = Math.min(36, Math.max(20, colW * 0.3));
  const plotH = 96;
  const height = plotH + 56;
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.floor(((e.clientX - r.left) / r.width) * verticals.length);
    setHover(i >= 0 && i < verticals.length ? i : null);
  };
  const h = hover != null ? hover : null;
  const readout = h != null ? `${verticals[h]!.name}: ${scores[h] == null ? 'no relevance' : `${score(scores[h] ?? null)} of 8.0, ${gradeOf(scores[h] ?? null)}${adjusted.includes(h) ? ', hand-adjusted' : ''}`}${owner === h ? ', owns this project' : ''}` : '';
  return (
    <div className="scroll-x chart-wrap" ref={ref}>
      <svg id={id} className="chart scores" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Relevance by vertical. ${verticals.map((v, i) => `${v.name}: ${score(scores[i]!)}`).join('. ')}.`} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={(e) => keyStep(e, verticals.length, hover, setHover)}>
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <line className="grid" x1={0} x2={width} y1={plotH + 0.5} y2={plotH + 0.5} />
        {verticals.map((v, i) => {
          const s = scores[i] ?? null;
          const bh = s == null ? 0 : (plotH * s) / 8;
          const g = gradeOf(s);
          return (
            <g key={v.slug} transform={`translate(${i * colW} 0)`}>
              {hover === i && <rect className="rowhi" x={0} y={0} width={colW} height={height} />}
              {owner === i && <rect className="own" x={4} y={2} width={colW - 8} height={height - 4} />}
              {s != null && <motion.rect className={cx('sbar', g === 'High' && 'g-high', g === 'Medium' && 'g-med', g === 'Low' && 'g-low', hover === i && 'mk-on')} x={colW / 2 - barW / 2} y={plotH - bh} width={barW} height={bh} style={{ transformOrigin: `0px ${plotH}px` }} {...(reduce ? {} : { initial: { scaleY: 0 }, animate: { scaleY: 1 }, transition: { duration: 0.45, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] } })} />}
              <text x={colW / 2} y={s == null ? plotH - 6 : plotH - bh - 5} textAnchor="middle" className="ink num-t">
                {s == null ? '-' : score(s)}
                {adjusted.includes(i) ? '*' : ''}
              </text>
              <text x={colW / 2} y={plotH + 16} textAnchor="middle" className="ink" style={{ fontSize: 10 }}>
                {labelLines(v.name).map((line, li) => (
                  <tspan key={li} x={colW / 2} dy={li === 0 ? 0 : 12}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text x={colW / 2} y={plotH + 44} textAnchor="middle" style={{ fontSize: 10 }}>
                {g ? g.toUpperCase() : 'NONE'}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={cx('mix-read', hover != null && 'on')} aria-live="polite">
        {readout || 'Point at a column, or use the arrow keys, to read a score.'}
      </p>
    </div>
  );
}

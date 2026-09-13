import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { scaleLinear } from 'd3-scale';
import { cx, pct } from '../lib/format';
import { fadeIn, riseTo } from './ChartMotion';
import { readboxAt } from './charts';
import { useWidth } from './useWidth';

/** The fills a segment may take, the family's ramp: ink, spot, ink-2, spot-2, ink-3, and hazard for a loss. */
export type SegClass = 'ink' | 'spot' | 'ink2' | 'spot2' | 'ink3' | 'hz' | 'rule';

export interface ColumnSeries {
  key: string;
  label: string;
  cls: SegClass;
}
export interface ColumnCategory {
  key: string;
  label: string;
  /** A shorter label for narrow widths. */
  short?: string;
}

interface Props {
  id: string;
  categories: ColumnCategory[];
  series: ColumnSeries[];
  /** values[categoryIndex][seriesIndex] */
  values: number[][];
  format: (n: number) => string;
  ariaLabel: string;
  /** `share` normalises every column to its own hundred percent. */
  mode?: 'value' | 'share';
  /** The unit printed on the axis, e.g. "AED m" or "projects". */
  unit: string;
  height?: number;
}

/**
 * Stacked columns, one per category, segments in series order from the baseline up.
 * Columns rise from the baseline in sequence and tween to a new shape when the data
 * changes under a filter. Pointing at a segment reads it out; the arrow keys walk
 * columns (left and right) and segments (up and down); Escape clears. The total
 * of each column is printed above it. Exact figures are in the table beside the chart.
 */
export function StackedColumns({ id, categories, series, values, format, ariaLabel, mode = 'value', unit, height: h0 }: Props) {
  const { ref, width } = useWidth(900);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<{ c: number; s: number | null } | null>(null);
  const narrow = width < 640;
  const height = h0 ?? (narrow ? 220 : 300);
  const m = { left: 64, right: 14, top: 30, bottom: narrow ? 52 : 42 };
  const plotW = Math.max(60, width - m.left - m.right);
  const plotH = height - m.top - m.bottom;
  const n = categories.length;
  const totals = values.map((col) => col.reduce((a, b) => a + b, 0));
  const share = mode === 'share';
  const domainMax = share ? 100 : Math.max(1, ...totals);
  const y = scaleLinear().domain([0, domainMax]).range([m.top + plotH, m.top]);
  const yTicks = share ? [0, 25, 50, 75, 100] : y.ticks(4);
  const slot = plotW / Math.max(1, n);
  const colW = Math.min(88, slot * 0.66);
  const baseline = m.top + plotH;
  const colX = (c: number) => m.left + slot * c + (slot - colW) / 2;
  /** Every segment's geometry, per column. */
  const geo = values.map((col, c) => {
    const total = totals[c]!;
    const scale = share ? (total ? 100 / total : 0) : 1;
    let acc = 0;
    return col.map((v, s) => {
      const v2 = v * scale;
      const y1 = y(acc + v2);
      const y0 = y(acc);
      acc += v2;
      return { c, s, v, x: colX(c), y: y1, h: Math.max(0, y0 - y1) };
    });
  });
  const hit = (px: number, py: number): { c: number; s: number | null } | null => {
    const c = Math.floor((px - m.left) / slot);
    if (c < 0 || c >= n) return null;
    const seg = geo[c]!.find((g) => py >= g.y && py <= g.y + g.h && g.h > 0);
    return { c, s: seg ? seg.s : null };
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(hit(e.clientX - r.left, e.clientY - r.top));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const cur = hover ?? { c: -1, s: null };
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setHover({ c: Math.min(n - 1, cur.c + 1), s: null });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover({ c: Math.max(0, cur.c < 0 ? n - 1 : cur.c - 1), s: null });
    } else if (e.key === 'ArrowUp' && cur.c >= 0) {
      e.preventDefault();
      const next = cur.s == null ? 0 : Math.min(series.length - 1, cur.s + 1);
      setHover({ c: cur.c, s: next });
    } else if (e.key === 'ArrowDown' && cur.c >= 0) {
      e.preventDefault();
      setHover({ c: cur.c, s: cur.s == null || cur.s === 0 ? null : cur.s - 1 });
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHover({ c: 0, s: null });
    } else if (e.key === 'End') {
      e.preventDefault();
      setHover({ c: n - 1, s: null });
    } else if (e.key === 'Escape') setHover(null);
  };
  const hc = hover ? categories[hover.c] : undefined;
  const readout = hover && hc ? (hover.s != null ? `${hc.label}, ${series[hover.s]!.label}: ${format(values[hover.c]![hover.s]!)} ${unit}, ${pct(totals[hover.c] ? (values[hover.c]![hover.s]! / totals[hover.c]!) * 100 : 0)} of the ${share ? 'column' : 'stage'}` : `${hc.label}: ${format(totals[hover.c]!)} ${unit}${share ? '' : `, ${series.map((s, i) => `${s.label} ${format(values[hover.c]![i]!)}`).join(', ')}`}`) : '';
  const box = hover ? readboxAt(readout.toUpperCase(), colX(hover.c) - 40, m.top - 26, width) : null;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg id={id} className="chart cols" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)}>
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <g className="grid">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={m.left} x2={width - m.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'zero' : undefined} />
              <text x={m.left - 8} y={y(t) + 4} textAnchor="end" className="muted">
                {share ? `${t}%` : format(t)}
              </text>
            </g>
          ))}
        </g>
        {hover && <rect className="rowhi" x={m.left + slot * hover.c} y={m.top - 4} width={slot} height={plotH + 4} />}
        {geo.map((col, c) =>
          col.map((g) => (
            <motion.rect key={`${c}-${g.s}`} className={cx('seg', `c-${series[g.s]!.cls}`, hover && hover.c === c && (hover.s === g.s || hover.s == null) && 'mk-on')} x={g.x} width={colW} {...riseTo(g.y, g.h, baseline, c * 0.04, reduce)} />
          )),
        )}
        {geo.map((col, c) => {
          const top = col.length ? Math.min(...col.map((g) => g.y)) : baseline;
          return (
            <motion.text key={`t-${c}`} x={colX(c) + colW / 2} y={top - 6} textAnchor="middle" className="ink num-t" style={{ fontSize: slot < 90 ? 9 : 11 }} {...fadeIn(0.3 + c * 0.04, reduce)}>
              {/* a printed total needs room: under 62px a slot cannot hold one, and the readout carries it instead */}
              {share || slot < 62 ? '' : format(totals[c]!)}
            </motion.text>
          );
        })}
        {categories.map((cat, c) => {
          const label = narrow && cat.short ? cat.short : cat.label;
          const words = label.split(' ');
          const lines = words.length > 2 && !narrow ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [label];
          return (
            <text key={cat.key} x={colX(c) + colW / 2} y={baseline + 16} textAnchor="middle" className="ink ax" style={{ fontSize: narrow ? 9 : 10.5 }}>
              {lines.map((l, i) => (
                <tspan key={i} x={colX(c) + colW / 2} dy={i === 0 ? 0 : 12}>
                  {l.toUpperCase()}
                </tspan>
              ))}
            </text>
          );
        })}
        {hover && box && (
          <g className="readbox">
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
            <text x={box.x + 8} y={box.y + 15}>
              {readout.toUpperCase()}
            </text>
          </g>
        )}
      </svg>
      <ul className="chart-legend" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key}>
            <i className={cx('sw', `c-${s.cls}`)} aria-hidden="true" /> {s.label}
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

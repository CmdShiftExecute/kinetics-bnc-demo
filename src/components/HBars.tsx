import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { scaleLinear } from 'd3-scale';
import { cx, pct } from '../lib/format';
import { growX } from './ChartMotion';
import type { SegClass } from './StackedColumns';
import { readboxAt } from './charts';
import { useWidth } from './useWidth';

export interface BarSeg {
  key: string;
  label: string;
  value: number;
  cls: SegClass;
}
export interface BarRow {
  key: string;
  name: string;
  /** Rows with the same group are drawn under one group label. */
  group?: string;
  segments: BarSeg[];
  /** Printed at the end of the bar. */
  end: string;
  /** Printed after `end`, muted. */
  endNote?: string;
}

interface Props {
  id: string;
  rows: BarRow[];
  format: (n: number) => string;
  ariaLabel: string;
  legend?: { cls: SegClass; label: string }[];
  mode?: 'value' | 'share';
  /** Rows become buttons: clicking or pressing Enter picks the row. */
  onPick?: (key: string) => void;
  /** The picked row, outlined. */
  activeKey?: string | null;
  /** The unit for the readout, e.g. "AED m" or "projects". */
  unit: string;
}

type Line = { kind: 'group'; label: string } | { kind: 'row'; i: number };

/**
 * Horizontal bars, one row per item, optionally under group labels: stacked
 * segments on the family's ramp, the figure printed at the end. Bars grow in from
 * the left in sequence and tween when the data changes. Pointing at a row, or
 * walking rows with the arrow keys, bands it and reads its figures out; with
 * `onPick`, a click or Enter selects it. Exact figures sit in the table beside it.
 */
export function HBars({ id, rows, format, ariaLabel, legend, mode = 'value', onPick, activeKey, unit }: Props) {
  const { ref, width } = useWidth(900);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const narrow = width < 560;
  const labelW = narrow ? 118 : 200;
  /* the right margin holds the longest end label in mono characters, so a note never runs off the edge */
  const endLen = Math.max(4, ...rows.map((r) => r.end.length + (r.endNote && !narrow ? r.endNote.length + 1 : 0)));
  const m = { left: labelW, right: Math.min(Math.round(width * 0.42), 16 + Math.round(endLen * 6.8)), top: 22, bottom: 6 };
  const rowH = 24;
  const groupH = 22;
  const barH = 12;
  const lines: Line[] = [];
  let lastGroup: string | undefined;
  rows.forEach((r, i) => {
    if (r.group && r.group !== lastGroup) {
      lines.push({ kind: 'group', label: r.group });
      lastGroup = r.group;
    }
    lines.push({ kind: 'row', i });
  });
  const yOf: number[] = [];
  let yAcc = m.top;
  const lineY = lines.map((l) => {
    const y = yAcc;
    yAcc += l.kind === 'group' ? groupH : rowH;
    if (l.kind === 'row') yOf[l.i] = y;
    return y;
  });
  const height = yAcc + m.bottom;
  const share = mode === 'share';
  const sumOf = (r: BarRow) => r.segments.reduce((a, s) => a + s.value, 0);
  const domainMax = share ? 100 : Math.max(1, ...rows.map(sumOf));
  const x = share ? scaleLinear().domain([0, 100]).range([m.left, width - m.right]) : scaleLinear().domain([0, domainMax]).range([m.left, width - m.right]).nice();
  const ticks = share ? [0, 25, 50, 75, 100] : x.ticks(narrow ? 3 : 5);
  const maxChars = Math.max(8, Math.floor((labelW - 14) / 6.6));
  const rowAt = (py: number): number | null => {
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k]!;
      if (l.kind === 'row' && py >= lineY[k]! && py < lineY[k]! + rowH) return l.i;
    }
    return null;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(rowAt(e.clientY - e.currentTarget.getBoundingClientRect().top));
  const step = (d: number) => setHover(Math.min(rows.length - 1, Math.max(0, (hover ?? (d > 0 ? -1 : rows.length)) + d)));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHover(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHover(rows.length - 1);
    } else if (e.key === 'Escape') setHover(null);
    else if ((e.key === 'Enter' || e.key === ' ') && onPick && hover != null) {
      e.preventDefault();
      onPick(rows[hover]!.key);
    }
  };
  const hr = hover != null ? rows[hover] : undefined;
  const total = hr ? sumOf(hr) : 0;
  const readout = hr ? `${hr.name}: ${format(total)} ${unit}${hr.segments.length > 1 ? ', ' + hr.segments.map((s) => `${s.label} ${format(s.value)}${share ? ` (${pct(total ? (s.value / total) * 100 : 0, 0)})` : ''}`).join(', ') : ''}` : '';
  const box = hr && hover != null ? readboxAt(readout.toUpperCase(), m.left + 8, yOf[hover]! - 18, width) : null;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg id={id} className={cx('chart hbars', onPick && 'pickable')} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={onPick ? 'listbox' : 'img'} aria-label={ariaLabel} tabIndex={0} onPointerMove={onMove} onPointerLeave={() => setHover(null)} onKeyDown={onKey} onBlur={() => setHover(null)} onClick={() => onPick && hover != null && onPick(rows[hover]!.key)}>
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        <g className="grid">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={m.top - 4} y2={height - m.bottom} />
              <text x={x(t)} y={m.top - 8} textAnchor="middle" className="muted">
                {share ? `${t}%` : format(t)}
              </text>
            </g>
          ))}
        </g>
        {lines.map((l, k) =>
          l.kind === 'group' ? (
            <text key={`g-${k}`} x={4} y={lineY[k]! + 15} className="ink grp">
              {l.label.toUpperCase()}
            </text>
          ) : null,
        )}
        {rows.map((r, i) => {
          const y0 = yOf[i]!;
          const scale = share ? (sumOf(r) ? 100 / sumOf(r) : 0) : 1;
          let acc = 0;
          const label = r.name.length > maxChars ? r.name.slice(0, maxChars - 1) + '.' : r.name;
          const isActive = activeKey != null && activeKey === r.key;
          return (
            <g key={r.key} className={cx(isActive && 'active')} role={onPick ? 'option' : undefined} aria-selected={onPick ? isActive : undefined}>
              {(hover === i || isActive) && <rect className={cx('rowhi', isActive && 'sel')} x={0} y={y0} width={width} height={rowH} />}
              <text x={m.left - 10} y={y0 + rowH / 2 + 4} textAnchor="end" className="ink">
                {label}
              </text>
              {r.segments.map((s) => {
                const v = s.value * scale;
                const x0 = x(acc);
                const w = Math.max(0, x(acc + v) - x0);
                acc += v;
                return <motion.rect key={s.key} className={cx('seg', `c-${s.cls}`, hover === i && 'mk-on')} x={x0} y={y0 + (rowH - barH) / 2} width={w} height={barH} style={{ transformOrigin: `${x0}px 0px` }} {...growX(i * 0.025, reduce)} />;
              })}
              <text x={x(share ? 100 : sumOf(r)) + 8} y={y0 + rowH / 2 + 4} className="ink num-t">
                {r.end}
                {r.endNote && !narrow ? <tspan className="muted"> {r.endNote}</tspan> : null}
              </text>
            </g>
          );
        })}
        {hr && box && (
          <g className="readbox">
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
            <text x={box.x + 8} y={box.y + 15}>
              {readout.toUpperCase()}
            </text>
          </g>
        )}
      </svg>
      {legend && (
        <ul className="chart-legend" aria-label="Legend">
          {legend.map((l) => (
            <li key={l.label}>
              <i className={cx('sw', `c-${l.cls}`)} aria-hidden="true" /> {l.label}
            </li>
          ))}
        </ul>
      )}
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

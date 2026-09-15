import { useState } from 'react';
import type { PointerEvent } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { SectorStageCell } from '../../data/schema';
import { SECTORS, STAGES } from '../../data/schema';
import { aedCompact, aedLabel, count, cx, pct } from '../lib/format';
import { keyStep, readboxAt } from './charts';
import { useWidth } from './useWidth';

/**
 * Value by sector and stage: one bar per sector, normalised to its own value so the
 * stage mix reads across sectors of very different size, with the sector's total at
 * the right. Stage tints run light (Concept) to ink (Completed). Pointing at a segment,
 * or walking segments with the arrow keys, reads it out. Exact figures are in the
 * table beside the chart.
 */
export function SectorStageChart({ cells, id }: { cells: SectorStageCell[]; id: string }) {
  const { ref, width } = useWidth(800);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const labelW = width < 560 ? 96 : 170;
  const m = { left: labelW, right: 92, top: 6, bottom: 6 };
  const rowH = 30;
  const barH = 16;
  const plotW = Math.max(60, width - m.left - m.right);
  const height = m.top + SECTORS.length * rowH + m.bottom;
  const rows = SECTORS.map((sector) => {
    const cs = STAGES.map((stage) => cells.find((c) => c.sector === sector && c.stage === stage) ?? { sector, stage, count: 0, value: 0 });
    const total = cs.reduce((a, c) => a + c.value, 0);
    const n = cs.reduce((a, c) => a + c.count, 0);
    let x = 0;
    const segs = cs.map((c, si) => {
      const w = total > 0 ? (plotW * c.value) / total : 0;
      const seg = { c, si, x, w };
      x += w;
      return seg;
    });
    return { sector, total, n, segs };
  });
  /* the flat list of segments the keyboard walks and the pointer hits */
  const flat = rows.flatMap((r, ri) => r.segs.map((s) => ({ ...s, ri, total: r.total })));
  const hit = (px: number, py: number): number | null => {
    const ri = Math.floor((py - m.top) / rowH);
    if (ri < 0 || ri >= rows.length) return null;
    const x = px - m.left;
    const idx = flat.findIndex((s) => s.ri === ri && x >= s.x && x < s.x + s.w);
    return idx >= 0 ? idx : null;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(hit(e.clientX - r.left, e.clientY - r.top));
  };
  const h = hover != null ? flat[hover] : undefined;
  const readout = h ? `${h.c.sector}, ${h.c.stage}: ${count(h.c.count)} projects, ${aedLabel(h.c.value)}, ${pct(h.total ? (h.c.value / h.total) * 100 : 0)} of the sector` : '';
  const box = h ? readboxAt(readout.toUpperCase(), m.left + h.x, m.top + h.ri * rowH - 14, width) : null;
  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        id={id}
        className="chart"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Value by sector and stage. ${rows.map((r) => `${r.sector}: ${aedLabel(r.total)} across ${count(r.n)} projects`).join('. ')}.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => keyStep(e, flat.length, hover, setHover)}
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" />
        {rows.map((r, ri) => (
          <g key={r.sector} transform={`translate(0 ${m.top + ri * rowH})`}>
            {hover != null && flat[hover]!.ri === ri && <rect className="rowhi" x={0} y={0} width={width} height={rowH} />}
            <text x={m.left - 10} y={rowH / 2 + 4} textAnchor="end" className="ink">
              {width < 560 && r.sector.length > 14 ? r.sector.slice(0, 13) + '.' : r.sector}
            </text>
            {r.segs.map((s) => (
              <motion.rect
                key={s.c.stage}
                className={cx('seg', `st${s.si}`, hover != null && flat[hover]!.ri === ri && flat[hover]!.si === s.si && 'mk-on')}
                x={m.left + s.x}
                y={(rowH - barH) / 2}
                width={Math.max(0, s.w - 1)}
                height={barH}
                style={{ transformOrigin: `${m.left}px 0px` }}
                {...(reduce ? {} : { initial: { scaleX: 0 }, whileInView: { scaleX: 1 }, viewport: { once: true }, transition: { duration: 0.5, delay: ri * 0.05, ease: [0.16, 1, 0.3, 1] } })}
              />
            ))}
            <text x={m.left + plotW + 8} y={rowH / 2 + 4} className="ink num-t">
              {aedCompact(r.total)}
            </text>
          </g>
        ))}
        {h && box && (
          <g className="readbox">
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
            <text x={box.x + 8} y={box.y + 15}>
              {readout.toUpperCase()}
            </text>
          </g>
        )}
      </svg>
      <p className="chart-axis-note">Share of each sector's value by stage, Concept (light) to Completed (ink); the sector total uses million, billion or trillion as appropriate.</p>
      <p className="sr-only" aria-live="polite">
        {readout}
      </p>
    </div>
  );
}

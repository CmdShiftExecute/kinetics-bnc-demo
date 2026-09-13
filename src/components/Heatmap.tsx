import { useMemo, useState } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { aedm } from '../lib/format';
import { useNavigate } from 'react-router';
import type { Grade, MatrixRow, Rollup } from '../../data/schema';
import { GRADES, SECTORS } from '../../data/schema';
import { count, cx } from '../lib/format';
import { valueStep } from '../lib/tint';

export interface CellInfo {
  label: string;
  vertical: string;
  grade: Grade | null;
  /** Projects graded on this vertical (High, Medium or Low). */
  graded: number;
  byGrade: Record<Grade, number>;
  /** Projects on the row (or group) regardless of grade. */
  projects: number;
  value: number;
  to: string;
}

type Level = 'sector' | 'industry' | 'type';
interface Line {
  key: string;
  level: Level;
  sector: string;
  industry?: string;
  type?: string;
  label: string;
  rows: number[];
  projects: number;
  value: number;
}

/** The grade a group of rows reads as on a vertical: the grade carrying the most projects, none if no row is graded. */
function groupCell(rollup: Rollup, rows: number[], vi: number): { grade: Grade | null; graded: number; byGrade: Record<Grade, number>; value: number } {
  const byGrade: Record<Grade, number> = { High: 0, Medium: 0, Low: 0 };
  let value = 0;
  for (const ri of rows) {
    const g = rollup.matrix[ri]!.cells[vi];
    if (g) {
      byGrade[g] += rollup.matrixRows[ri]!.count;
      value += rollup.matrixRows[ri]!.value;
    }
  }
  const graded = byGrade.High + byGrade.Medium + byGrade.Low;
  const grade = graded === 0 ? null : (GRADES.reduce((best, g) => (byGrade[g] > byGrade[best] ? g : best), 'High' as Grade) as Grade);
  return { grade, graded, byGrade, value: Math.round(value * 10) / 10 };
}

/**
 * The relevance matrix as a heatmap: rows are project types grouped under industry
 * under sector, collapsible; columns are the ten verticals; a cell is the grade,
 * tinted on one sequential ink scale (or one slate scale for value). Pointing at a
 * cell reports it to the side panel; clicking opens the Projects page filtered to
 * that row and vertical. A toggle rolls the rows up to sector level.
 */
export function Heatmap({ rollup, rolled, colour }: { rollup: Rollup; rolled: boolean; colour: 'grade' | 'value' }) {
  const navigate = useNavigate();
  /* the tooltip: the cell under the pointer (or the focused cell), placed beside the cursor and flipped away from the viewport edge */
  const [tip, setTip] = useState<{ info: CellInfo; x: number; y: number } | null>(null);
  const place = (info: CellInfo, clientX: number, clientY: number) => {
    const w = 300;
    const h = 150;
    const x = clientX + 16 + w > window.innerWidth ? clientX - 16 - w : clientX + 16;
    const y = clientY + 12 + h > window.innerHeight ? clientY - 12 - h : clientY + 12;
    setTip({ info, x: Math.max(4, x), y: Math.max(4, y) });
  };
  const onCellMove = (info: CellInfo) => (e: PointerEvent<HTMLButtonElement>) => place(info, e.clientX, e.clientY);
  const onCellFocus = (info: CellInfo) => (e: FocusEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    place(info, r.right, r.top + r.height / 2);
  };
  const [open, setOpen] = useState<Set<string>>(() => new Set(SECTORS));
  const lines = useMemo<Line[]>(() => {
    const out: Line[] = [];
    for (const sector of SECTORS) {
      const sRows = rollup.matrix.map((r, i) => (r.sector === sector ? i : -1)).filter((i) => i >= 0);
      const agg = (rows: number[]) => ({ projects: rows.reduce((a, i) => a + rollup.matrixRows[i]!.count, 0), value: Math.round(rows.reduce((a, i) => a + rollup.matrixRows[i]!.value * 10, 0)) / 10 });
      out.push({ key: sector, level: 'sector', sector, label: sector, rows: sRows, ...agg(sRows) });
      if (rolled || !open.has(sector)) continue;
      const industries = [...new Set(sRows.map((i) => rollup.matrix[i]!.industry))];
      for (const industry of industries) {
        const iRows = sRows.filter((i) => rollup.matrix[i]!.industry === industry);
        const ikey = `${sector}|${industry}`;
        out.push({ key: ikey, level: 'industry', sector, industry, label: industry, rows: iRows, ...agg(iRows) });
        if (!open.has(ikey)) continue;
        for (const ri of iRows) {
          const r: MatrixRow = rollup.matrix[ri]!;
          out.push({ key: `${ikey}|${r.type}`, level: 'type', sector, industry, type: r.type, label: r.type, rows: [ri], ...agg([ri]) });
        }
      }
    }
    return out;
  }, [rollup, rolled, open]);
  /*
   * The value tint's domain, one per level, computed from EVERY row of the matrix at that
   * level (all 5 sectors, every industry, all 80 types), never from what happens to be
   * expanded: a sector cell is tinted against the largest sector cell, an industry cell
   * against the largest industry cell, a type cell against the largest type cell. So a
   * fresh page with nothing expanded tints its sector rows on the full five-step scale,
   * and opening a row never re-tints the rows already on screen.
   */
  const maxByLevel = useMemo(() => {
    const cellsAt = (rowSets: number[][]) => Math.max(1, ...rowSets.flatMap((rows) => rollup.verticals.map((_, vi) => groupCell(rollup, rows, vi).value)));
    const sectorRows = SECTORS.map((sector) => rollup.matrix.map((r, i) => (r.sector === sector ? i : -1)).filter((i) => i >= 0));
    const industryRows = [...new Set(rollup.matrix.map((r) => `${r.sector}|${r.industry}`))].map((key) => rollup.matrix.map((r, i) => (`${r.sector}|${r.industry}` === key ? i : -1)).filter((i) => i >= 0));
    const typeRows = rollup.matrix.map((_r, i) => [i]);
    return { sector: cellsAt(sectorRows), industry: cellsAt(industryRows), type: cellsAt(typeRows) } as Record<Level, number>;
  }, [rollup]);
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const linkFor = (l: Line, vslug: string) => {
    const sp = new URLSearchParams();
    if (l.level === 'sector') sp.set('sector', l.sector);
    if (l.level === 'industry') sp.set('industry', l.industry!);
    if (l.level === 'type') {
      sp.set('type', l.type!);
      sp.set('industry', l.industry!);
      sp.set('sector', l.sector);
    }
    sp.set('v', vslug);
    return `/projects?${sp.toString()}`;
  };
  const cellInfo = (l: Line, vi: number): CellInfo => {
    const g = groupCell(rollup, l.rows, vi);
    return { label: l.level === 'type' ? `${l.type}, ${l.industry}, ${l.sector}` : l.level === 'industry' ? `${l.industry}, ${l.sector}` : l.sector, vertical: rollup.verticals[vi]!.name, grade: g.grade, graded: g.graded, byGrade: g.byGrade, projects: l.projects, value: g.value, to: linkFor(l, rollup.verticals[vi]!.slug) };
  };
  const step = (v: number, level: Level) => valueStep(v, maxByLevel[level]);
  return (
    <div className="scroll-x">
      <table className="mis heat" id="heatmap">
        <thead>
          <tr>
            <th scope="col" className="left">
              {rolled ? 'Sector' : 'Sector, industry, project type'}
            </th>
            <th scope="col" className="num">
              Projects
            </th>
            {rollup.verticals.map((v) => (
              <th key={v.slug} scope="col" className="heat-h">
                <span>{v.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.key} className={cx('hov', `lv-${l.level}`)}>
              <th scope="row" className="left">
                {l.level !== 'type' && !rolled ? (
                  <button type="button" className="disc" aria-expanded={open.has(l.key)} onClick={() => toggle(l.key)}>
                    <span className="disc-mark" aria-hidden="true">
                      {open.has(l.key) ? '−' : '+'}
                    </span>
                    {l.label}
                  </button>
                ) : (
                  <span className={l.level === 'type' ? 'lv-type-label' : undefined}>{l.label}</span>
                )}
              </th>
              <td className="num">{count(l.projects)}</td>
              {rollup.verticals.map((v, vi) => {
                const g = groupCell(rollup, l.rows, vi);
                const cls = colour === 'grade' ? (g.grade ? `hg-${g.grade.toLowerCase()}` : 'hg-none') : g.grade ? `hv-${step(g.value, l.level)}` : 'hg-none';
                return (
                  <td key={v.slug} className={cx('heat-c', cls)} data-level={l.level} data-value={g.value}>
                    <button
                      type="button"
                      className="heat-b"
                      aria-label={`${l.label}, ${v.name}: ${g.grade ?? 'no relevance'}, ${count(g.graded)} projects`}
                      onPointerEnter={onCellMove(cellInfo(l, vi))}
                      onPointerMove={onCellMove(cellInfo(l, vi))}
                      onFocus={onCellFocus(cellInfo(l, vi))}
                      onPointerLeave={() => setTip(null)}
                      onBlur={() => setTip(null)}
                      onClick={() => navigate(linkFor(l, v.slug))}
                      data-grade={g.grade ?? 'none'}
                      data-count={g.graded}
                    >
                      <span className="hg-t">{g.grade ? g.grade.slice(0, 1) : '·'}</span>
                      <span className="hg-n">{g.grade ? count(g.graded) : ''}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {tip && (
        <div className="cell-tip" id="cell-tip" role="status" style={{ left: tip.x, top: tip.y }} data-grade={tip.info.grade ?? 'none'}>
          <p className="cell-title">
            <strong>{tip.info.label}</strong>
            <br />
            {tip.info.vertical}
          </p>
          <dl className="tip-vals">
            <div>
              <dt>Grade</dt>
              <dd>{tip.info.grade ?? 'None'}</dd>
            </div>
            <div>
              <dt>Projects graded</dt>
              <dd>
                {count(tip.info.graded)} of {count(tip.info.projects)}
                {tip.info.grade && tip.info.graded !== tip.info.byGrade[tip.info.grade] ? ` (H ${count(tip.info.byGrade.High)}, M ${count(tip.info.byGrade.Medium)}, L ${count(tip.info.byGrade.Low)})` : ''}
              </dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>AED {aedm(tip.info.value)} m</dd>
            </div>
          </dl>
          <p className="tip-hint">Click to open these projects</p>
        </div>
      )}
    </div>
  );
}

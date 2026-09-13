import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Grade, MatrixRow, Rollup } from '../../data/schema';
import { GRADES, SECTORS } from '../../data/schema';
import { count, cx } from '../lib/format';

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
export function Heatmap({ rollup, rolled, colour, onCell }: { rollup: Rollup; rolled: boolean; colour: 'grade' | 'value'; onCell: (c: CellInfo | null) => void }) {
  const navigate = useNavigate();
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
  const maxValue = useMemo(() => Math.max(1, ...lines.filter((l) => l.level === (rolled ? 'sector' : 'type')).flatMap((l) => rollup.verticals.map((_, vi) => groupCell(rollup, l.rows, vi).value))), [lines, rollup, rolled]);
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
  const step = (v: number) => Math.min(5, Math.max(1, Math.ceil((5 * v) / maxValue)));
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
                const cls = colour === 'grade' ? (g.grade ? `hg-${g.grade.toLowerCase()}` : 'hg-none') : g.grade ? `hv-${step(g.value)}` : 'hg-none';
                return (
                  <td key={v.slug} className={cx('heat-c', cls)}>
                    <button
                      type="button"
                      className="heat-b"
                      aria-label={`${l.label}, ${v.name}: ${g.grade ?? 'no relevance'}, ${count(g.graded)} projects`}
                      onPointerEnter={() => onCell(cellInfo(l, vi))}
                      onFocus={() => onCell(cellInfo(l, vi))}
                      onPointerLeave={() => onCell(null)}
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
    </div>
  );
}

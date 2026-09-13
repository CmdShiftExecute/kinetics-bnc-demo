import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { gradeOf } from '../../data/rules';
import type { Project } from '../../data/schema';
import type { SortDir, SortKey } from '../lib/filters';
import { aedm, count, cx, dateLabel, pct, score } from '../lib/format';
import { SortTh } from './SortTh';

export interface Column {
  key: SortKey;
  label: string;
  natural: SortDir;
  width: number;
  num?: boolean;
  /** Optional columns are off by default and chosen from the column menu. */
  optional?: boolean;
}

export const COLUMNS: Column[] = [
  { key: 'ref', label: 'Ref', natural: 'asc', width: 108 },
  { key: 'name', label: 'Project', natural: 'asc', width: 260 },
  { key: 'stage', label: 'Stage', natural: 'asc', width: 170 },
  { key: 'completionPct', label: 'Done', natural: 'desc', width: 70, num: true },
  { key: 'value', label: 'AED m', natural: 'desc', width: 100, num: true },
  { key: 'overall', label: 'Relev.', natural: 'desc', width: 70, num: true },
  { key: 'score', label: 'Score', natural: 'desc', width: 70, num: true, optional: true },
  { key: 'owner', label: 'Owner', natural: 'asc', width: 150 },
  { key: 'city', label: 'City', natural: 'asc', width: 120 },
  { key: 'sector', label: 'Sector', natural: 'asc', width: 150, optional: true },
  { key: 'industry', label: 'Industry', natural: 'asc', width: 190, optional: true },
  { key: 'type', label: 'Type', natural: 'asc', width: 190 },
  { key: 'lastUpdated', label: 'Updated', natural: 'desc', width: 110, optional: true },
];

export const ROW_H = 34;
const OVERSCAN = 8;

interface Props {
  rows: Project[];
  sort: { key: SortKey; dir: SortDir };
  onSort: (key: SortKey, natural: SortDir) => void;
  shown: Set<SortKey>;
  engineerName: Map<string, string>;
  /** The vertical the Score column reads, when a vertical filter is on. */
  scoreIndex: number | null;
  scoreName?: string;
  height: number;
}

/**
 * The register as a windowed table: only the rows in view (plus a margin) are in the
 * DOM, positioned by two spacer rows, so 3,500 rows scroll like 30. The header is
 * sticky inside the scroll box, the layout is fixed so widths never jump, and every
 * row is a link to its project drill.
 */
export function VirtualTable({ rows, sort, onSort, shown, engineerName, scoreIndex, scoreName, height }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(0);
  const [viewH, setViewH] = useState(height);
  useEffect(() => setViewH(height), [height]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const onScroll = useCallback(() => {
    const el = box.current;
    if (el) setTop(el.scrollTop);
  }, []);
  /* jump back to the top when the row set changes, so a new filter never leaves the view mid-list */
  const firstRef = rows[0]?.ref ?? '';
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
    setTop(0);
  }, [firstRef, rows.length, sort.key, sort.dir]);

  const cols = useMemo(() => COLUMNS.filter((c) => !c.optional || shown.has(c.key)).filter((c) => c.key !== 'score' || scoreIndex !== null), [shown, scoreIndex]);
  const total = rows.length;
  const start = Math.max(0, Math.floor(top / ROW_H) - OVERSCAN);
  const end = Math.min(total, Math.ceil((top + viewH) / ROW_H) + OVERSCAN);
  const slice = rows.slice(start, end);
  const width = cols.reduce((a, c) => a + c.width, 0);
  const cell = (p: Project, c: Column) => {
    switch (c.key) {
      case 'ref':
        return p.ref;
      case 'name':
        return (
          <Link to={`/p/${p.ref}`} className="row-link">
            {p.name}
          </Link>
        );
      case 'stage':
        return p.stage;
      case 'completionPct':
        return p.completionPct == null ? '' : pct(p.completionPct);
      case 'value':
        return aedm(p.value);
      case 'overall':
        return score(p.overall);
      case 'score':
        return scoreIndex == null ? '' : score(p.scores[scoreIndex] ?? null);
      case 'owner':
        return p.ownerEngineer ? engineerName.get(p.ownerEngineer) : <span className="muted">none</span>;
      case 'city':
        return p.city;
      case 'sector':
        return p.sector;
      case 'industry':
        return p.industry;
      case 'type':
        return p.type;
      case 'lastUpdated':
        return dateLabel(p.lastUpdated);
    }
  };
  return (
    <div className="vt" ref={box} onScroll={onScroll} style={{ height }} tabIndex={-1} data-total={total} data-start={start} data-end={end}>
      <table className="mis dense vt-table" style={{ width, minWidth: '100%' }}>
        <colgroup>
          {cols.map((c) => (
            <col key={c.key} style={{ width: c.width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {cols.map((c) => (
              <SortTh key={c.key} label={c.key === 'score' && scoreName ? `${scoreName} score` : c.label} active={sort.key === c.key} dir={sort.dir} natural={c.natural} onSort={(n) => onSort(c.key, n)} className={c.num ? 'num' : 'left'} title={c.key === 'overall' ? 'Overall relevance: the highest of the ten vertical scores' : c.key === 'completionPct' ? 'Percent complete, under construction only' : undefined} />
            ))}
          </tr>
        </thead>
        <tbody>
          {start > 0 && (
            <tr className="vt-pad" aria-hidden="true">
              <td colSpan={cols.length} style={{ height: start * ROW_H, padding: 0, border: 0 }} />
            </tr>
          )}
          {slice.map((p) => (
            <tr key={p.ref} className={cx('hov', 'vt-row', p.overall != null && gradeOf(p.overall) === 'High' && 'hi')} style={{ height: ROW_H }} data-ref={p.ref}>
              {cols.map((c) => (
                <td key={c.key} className={cx(c.num ? 'num' : 'left', 'vt-cell')}>
                  {cell(p, c)}
                </td>
              ))}
            </tr>
          ))}
          {end < total && (
            <tr className="vt-pad" aria-hidden="true">
              <td colSpan={cols.length} style={{ height: (total - end) * ROW_H, padding: 0, border: 0 }} />
            </tr>
          )}
          {total === 0 && (
            <tr>
              <td colSpan={cols.length} className="left">
                <div className="empty" id="no-rows">
                  <strong>No project matches these filters.</strong> Loosen a range or clear a facet; the count above updates as you do.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="sr-only" aria-live="polite">
        {count(total)} projects listed
      </p>
    </div>
  );
}

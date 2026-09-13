import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useSearchParams } from 'react-router';
import { useRegister } from '../lib/register';
import type { Filters, SortDir, SortKey } from '../lib/filters';
import { EMPTY, activeCount, matches, parseFilters, serialiseFilters, sortProjects } from '../lib/filters';
import { aedm, count, cx, dateLabel, pct, score } from '../lib/format';
import { toCsv, download } from '../lib/csv';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise } from '../components/Reveal';
import { FilterRail } from '../components/FilterRail';
import { Chips, chipsFor } from '../components/Chips';
import { COLUMNS, VirtualTable } from '../components/VirtualTable';
import { BUCKETS, STAGES } from '../../data/schema';
import { gradeOf } from '../../data/rules';
import { Strip } from '../components/Strip';
import { Section } from '../components/Section';
import { StackedColumns } from '../components/StackedColumns';
import { ChartSwitch } from '../components/ChartSwitch';
import { STAGE_SHORT } from './Overview';

const OPTIONAL = COLUMNS.filter((c) => c.optional).map((c) => c.key);

/** The full register with the filter rail, chips, the always-visible count and value, sort, a column chooser and CSV export. State lives in the URL. */
export default function ProjectsPage() {
  const reg = useRegister();
  const [sp, setSp] = useSearchParams();
  const rise = useRise();
  const [railOpen, setRailOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true));
  const [shown, setShown] = useState<Set<SortKey>>(() => new Set<SortKey>(sp.get('cols')?.split('|').filter((c) => OPTIONAL.includes(c as SortKey)) as SortKey[]));
  const [tableH, setTableH] = useState(560);
  useEffect(() => {
    const fit = () => setTableH(Math.max(360, window.innerHeight - 300));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const rollup = reg.data?.rollup;
  const filters = useMemo<Filters>(() => (rollup ? parseFilters(sp, rollup) : EMPTY), [sp, rollup]);
  const vIndex = useMemo(() => new Map((rollup?.verticals ?? []).map((v, i) => [v.slug, i])), [rollup]);
  const engineerName = useMemo(() => new Map((rollup?.engineers ?? []).map((e) => [e.slug, e.name])), [rollup]);
  const set = useCallback(
    (patch: Partial<Filters>, push = true) => {
      const next = serialiseFilters({ ...filters, ...patch });
      if (shown.size) next.set('cols', [...shown].join('|'));
      setSp(next, { replace: !push });
    },
    [filters, setSp, shown],
  );
  const clearAll = () => {
    const next = new URLSearchParams();
    if (shown.size) next.set('cols', [...shown].join('|'));
    setSp(next);
  };
  const rows = useMemo(() => (reg.data ? sortProjects(reg.data.projects.filter((p) => matches(p, filters, vIndex)), filters, vIndex, engineerName) : []), [reg.data, filters, vIndex, engineerName]);
  const total = useMemo(() => rows.reduce((a, p) => a + Math.round(p.value * 10), 0) / 10, [rows]);
  /* the headline figures and the chart of the CURRENT view: recomputed with every filter change from the same rows the table shows */
  const view = useMemo(() => {
    const vi = filters.vertical ? (vIndex.get(filters.vertical) ?? null) : null;
    const owned = rows.filter((p) => p.ownerVertical != null);
    const high = rows.filter((p) => gradeOf(p.overall) === 'High');
    const pairs = (codes: number[]) => rows.reduce((a, p) => a + (vi != null ? (codes.includes(p.buckets[vi]!) ? 1 : 0) : p.buckets.filter((b) => codes.includes(b)).length), 0);
    const byStage = STAGES.map((st) => {
      const ps = rows.filter((p) => p.stage === st);
      const own = ps.filter((p) => p.ownerVertical != null);
      return { count: [own.length, ps.length - own.length], value: [Math.round(own.reduce((a, p) => a + p.value * 10, 0)) / 10, Math.round(ps.filter((p) => p.ownerVertical == null).reduce((a, p) => a + p.value * 10, 0)) / 10] };
    });
    return { owned: owned.length, ownedValue: Math.round(owned.reduce((a, p) => a + p.value * 10, 0)) / 10, high: high.length, open: pairs([1, 2]), orders: pairs([0]), byStage, vi };
  }, [rows, filters.vertical, vIndex]);
  if (reg.error) return <PageError message={reg.error} />;
  if (!reg.data || !rollup) return <PageLoading rows={14} />;
  const { meta } = rollup;
  const vi = filters.vertical ? (vIndex.get(filters.vertical) ?? null) : null;
  const scoreName = vi != null ? rollup.verticals[vi]!.name : undefined;
  const chips = chipsFor(filters, rollup, reg.data.consultants, reg.data.contractors);
  const onSort = (key: SortKey, natural: SortDir) => set({ sort: key, dir: filters.sort === key ? (filters.dir === 'asc' ? 'desc' : 'asc') : natural }, false);
  const exportCsv = () => {
    const header = ['Reference', 'Project', 'Stage', 'Completion %', 'Value AED m', 'City', 'Sector', 'Industry', 'Type', 'Category', 'Overall relevance', ...rollup.verticals.map((v) => `${v.name} score`), 'Owner vertical', 'Owner engineer', ...rollup.verticals.map((v) => `${v.name} activity`), 'Last updated'];
    const body = rows.map((p) => [p.ref, p.name, p.stage, p.completionPct, p.value, p.city, p.sector, p.industry, p.type, p.category, p.overall, ...p.scores, p.ownerVertical == null ? '' : rollup.verticals[p.ownerVertical]!.name, p.ownerEngineer ? (engineerName.get(p.ownerEngineer) ?? '') : '', ...p.buckets.map((b) => BUCKETS[b]!), dateLabel(p.lastUpdated)]);
    download(`halvard-projects-${rows.length}.csv`, toCsv(header, body));
  };
  const toggleCol = (key: SortKey) => {
    const n = new Set(shown);
    if (n.has(key)) n.delete(key);
    else n.add(key);
    setShown(n);
    const next = serialiseFilters(filters);
    if (n.size) next.set('cols', [...n].join('|'));
    setSp(next, { replace: true });
  };
  return (
    <div className="wrap wide">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Projects</h1>
          <p className="page-sub">The market register, every project, with the filters on the left and the view in the address bar</p>
        </div>
        <p className="page-basis">
          {count(reg.data.projects.length)} projects in the register
          <br />
          Click a project name to open its page
        </p>
      </motion.div>

      <Strip
        id="view-kpis"
        label="The current view"
        cols={6}
        items={[
          { label: 'Projects in view', value: rows.length, f: count, sub: `of ${count(reg.data.projects.length)} in the register`, id: 'vk-count' },
          { label: 'Value in view', value: total, sub: `AED million, ${pct(reg.data.projects.length ? (total / (reg.data.rollup.sectorStage.reduce((a, c) => a + Math.round(c.value * 10), 0) / 10)) * 100 : 0)} of the register`, id: 'vk-value' },
          { label: 'Owned', value: view.owned, f: count, sub: `${rows.length ? pct((view.owned / rows.length) * 100) : '0.0%'} of the view, AED ${aedm(view.ownedValue)} m`, id: 'vk-owned' },
          { label: 'Reading High overall', value: view.high, f: count, sub: `${rows.length ? pct((view.high / rows.length) * 100) : '0.0%'} of the view`, id: 'vk-high' },
          { label: 'Open enquiries and quotes', value: view.open, f: count, sub: view.vi != null ? `on ${scoreName}` : 'project and vertical pairs', id: 'vk-open' },
          { label: 'Orders received', value: view.orders, f: count, sub: view.vi != null ? `on ${scoreName}` : 'project and vertical pairs', id: 'vk-orders' },
        ]}
      />
      <Section id="view-chart" title="The view by stage" note="The projects in the current view along the lifecycle, owned against not yet owned; the chart re-shapes as the filters change">
        <ChartSwitch
          id="view-chart"
          views={[
            { key: 'count', label: 'Projects', render: () => <StackedColumns id="view-columns" categories={STAGES.map((st) => ({ key: st, label: st, short: STAGE_SHORT[st] }))} series={[{ key: 'owned', label: 'Owned', cls: 'spot' }, { key: 'unowned', label: 'No owner', cls: 'ink3' }]} values={view.byStage.map((b) => b.count)} format={count} unit="projects" height={240} ariaLabel={`Projects in view by stage. ${STAGES.map((st, i) => `${st}: ${count(view.byStage[i]!.count[0]! + view.byStage[i]!.count[1]!)}`).join('. ')}.`} /> },
            { key: 'value', label: 'Value, AED m', render: () => <StackedColumns id="view-columns" categories={STAGES.map((st) => ({ key: st, label: st, short: STAGE_SHORT[st] }))} series={[{ key: 'owned', label: 'Owned', cls: 'spot' }, { key: 'unowned', label: 'No owner', cls: 'ink3' }]} values={view.byStage.map((b) => b.value)} format={aedm} unit="AED m" height={240} ariaLabel={`Value in view by stage. ${STAGES.map((st, i) => `${st}: AED ${aedm(view.byStage[i]!.value[0]! + view.byStage[i]!.value[1]!)} million`).join('. ')}.`} /> },
          ]}
        />
      </Section>

      <div className={cx('dash', !railOpen && 'rail-hidden')}>
        <FilterRail rollup={rollup} projects={reg.data.projects} consultants={reg.data.consultants} contractors={reg.data.contractors} filters={filters} set={set} vIndex={vIndex} open={railOpen} />
        <div className="dash-main">
          <div className="toolbar" id="toolbar">
            <button type="button" className="btn press" id="rail-toggle" aria-expanded={railOpen} aria-controls="rail" onClick={() => setRailOpen((o) => !o)}>
              {railOpen ? 'Hide filters' : `Filters${activeCount(filters) ? ` (${activeCount(filters)})` : ''}`}
            </button>
            <p className="tally" id="tally" data-count={rows.length} data-value={total}>
              <strong id="match-count">{count(rows.length)}</strong> of {count(reg.data.projects.length)} projects, <strong id="match-value">AED {aedm(total)} m</strong>
            </p>
            <details className="menu" id="cols-menu">
              <summary className="btn press">Columns</summary>
              <div className="menu-body">
                {COLUMNS.filter((c) => c.optional).map((c) => (
                  <label key={c.key} className="facet-opt">
                    <input type="checkbox" checked={shown.has(c.key)} onChange={() => toggleCol(c.key)} data-col={c.key} />
                    <span className="facet-name">{c.label}</span>
                  </label>
                ))}
              </div>
            </details>
            <button type="button" className="btn press" id="csv" onClick={exportCsv}>
              Export CSV
            </button>
          </div>
          <Chips chips={chips} set={(patch) => set(patch)} clearAll={clearAll} />
          <VirtualTable rows={rows} sort={{ key: filters.sort, dir: filters.dir }} onSort={onSort} shown={shown} engineerName={engineerName} scoreIndex={vi} scoreName={scoreName} height={tableH} />
          <p className="muted" style={{ fontSize: 11, margin: 'var(--s-sm) 0 0' }}>
            Relev. is the highest of the ten vertical scores{vi != null ? `; Score is the ${scoreName} score` : ''}. Done is percent complete, under construction only. Sorted by {COLUMNS.find((c) => c.key === filters.sort)?.label ?? filters.sort}, {filters.dir === 'asc' ? 'ascending' : 'descending'}
            {rows[0] ? `; first row ${rows[0].ref}, relevance ${score(rows[0].overall)}` : ''}.
          </p>
        </div>
      </div>
      <Footer meta={meta} />
    </div>
  );
}

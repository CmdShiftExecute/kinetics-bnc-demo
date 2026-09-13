import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import { STAGES } from '../../data/schema';
import { useRegister } from '../lib/register';
import type { SortDir, SortKey } from '../lib/filters';
import { EMPTY, sortProjects } from '../lib/filters';
import { aedm, count, pct } from '../lib/format';
import { Crumbs, Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise, useRowReveal } from '../components/Reveal';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { FunnelChart } from '../components/FunnelChart';
import { StackedColumns } from '../components/StackedColumns';
import { ChartSwitch } from '../components/ChartSwitch';
import { VirtualTable } from '../components/VirtualTable';
import { roleLabel } from '../components/PartyPicker';
import { STAGE_SHORT } from './Overview';

/** One engineer's book: six figures, one full-width visual (the funnel, or the book by stage), the full project table, and the consultants and contractors they hold. */
export default function EngineerPage() {
  const { slug } = useParams();
  const reg = useRegister();
  const rise = useRise();
  const rowReveal = useRowReveal();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'value', dir: 'desc' });
  const rollup = reg.data?.rollup;
  const engineer = rollup?.engineers.find((e) => e.slug === slug);
  const summary = rollup?.engineerSummary.find((e) => e.slug === slug);
  const vIndex = useMemo(() => new Map((rollup?.verticals ?? []).map((v, i) => [v.slug, i])), [rollup]);
  const engineerName = useMemo(() => new Map((rollup?.engineers ?? []).map((e) => [e.slug, e.name])), [rollup]);
  const owned = useMemo(() => (reg.data && engineer ? sortProjects(reg.data.projects.filter((p) => p.ownerEngineer === engineer.slug), { ...EMPTY, sort: sort.key, dir: sort.dir }, vIndex, engineerName) : []), [reg.data, engineer, sort, vIndex, engineerName]);
  if (reg.error) return <PageError message={reg.error} />;
  if (!reg.data || !rollup) return <PageLoading rows={12} />;
  if (!engineer || !summary) return <PageError message={`No such engineer: "${slug}". The 24 engineers are listed on the Engineers page.`} back={{ to: '/engineers', label: 'Back to the engineers' }} />;
  const { meta, definitions } = rollup;
  const vi = vIndex.get(engineer.vertical)!;
  const vertical = rollup.verticals[vi]!;
  const ownedRefs = new Set(owned.map((p) => p.ref));
  const held = (list: typeof reg.data.consultants) => list.filter((c) => c.owner === engineer.slug || c.projects.some((r) => ownedRefs.has(r))).map((c) => ({ c, onBook: c.projects.filter((r) => ownedRefs.has(r)).length })).sort((a, b) => b.onBook - a.onBook || (b.c.rating ?? 0) - (a.c.rating ?? 0)).slice(0, 12);
  const cons = held(reg.data.consultants);
  const cont = held(reg.data.contractors);
  const largest = [...owned].sort((a, b) => b.value - a.value)[0];
  const byStage = STAGES.map((st) => {
    const ps = owned.filter((p) => p.stage === st);
    const active = ps.filter((p) => [1, 2, 3, 5, 6].includes(p.buckets[vi]!));
    return { count: [active.length, ps.length - active.length], value: [Math.round(active.reduce((a, p) => a + p.value * 10, 0)) / 10, Math.round(ps.filter((p) => ![1, 2, 3, 5, 6].includes(p.buckets[vi]!)).reduce((a, p) => a + p.value * 10, 0)) / 10] };
  });
  const categories = STAGES.map((st) => ({ key: st, label: st, short: STAGE_SHORT[st] }));
  const series = [
    { key: 'active', label: 'Active on this vertical', cls: 'spot' as const },
    { key: 'other', label: 'Won, waiting, quiet or closed', cls: 'ink3' as const },
  ];
  return (
    <div className="wrap wide">
      <Masthead meta={meta} />
      <Crumbs items={[{ to: '/engineers', label: 'Engineers' }, { label: engineer.name }]} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">{engineer.name}</h1>
          <p className="page-sub">
            {vertical.name}, sells through {vertical.channel === 'both' ? 'consultants and contractors' : vertical.channel}
          </p>
        </div>
        <p className="page-basis">
          <Link to={`/projects?eng=${engineer.slug}`} className="vlink">
            Open this book in Projects with filters
          </Link>
          <br />
          {count(summary.owned)} projects, AED {aedm(summary.ownedValue)} m
        </p>
      </motion.div>
      <Strip
        id="eng-strip"
        cols={6}
        label="Engineer figures"
        items={[
          { label: 'Projects owned', value: summary.owned, f: count, sub: `${pct((summary.owned / Math.max(1, rollup.verticalSummary[vi]!.owned)) * 100)} of the ${count(rollup.verticalSummary[vi]!.owned)} on ${vertical.name}`, to: `/projects?eng=${engineer.slug}`, id: 'eng-owned' },
          { label: 'Pipeline value', value: summary.ownedValue, sub: `AED million, ${pct((summary.ownedValue / Math.max(0.1, rollup.kpis.ownedValue)) * 100)} of all owned value`, id: 'eng-value' },
          { label: 'Workload', value: summary.loadPct, f: (n) => pct(n, 0), sub: `${count(summary.workload)} points against ${count(summary.capacity)}, ${summary.overloaded ? 'over capacity' : 'within capacity'}`, bad: summary.overloaded, id: 'eng-load' },
          { label: 'Enquiries and quotes', value: summary.funnel[1]! + summary.funnel[2]!, f: count, sub: `on ${vertical.name}, of ${count(summary.owned)} owned`, to: `/projects?eng=${engineer.slug}&v=${vertical.slug}&bucket=1|2`, id: 'eng-open' },
          { label: 'Orders received', value: summary.funnel[0]!, f: count, sub: `${count(summary.funnel[4]!)} closed`, to: `/projects?eng=${engineer.slug}&v=${vertical.slug}&bucket=0`, id: 'eng-orders' },
          { label: 'Largest project', value: largest?.value ?? 0, sub: largest ? `AED m, ${largest.name}` : 'none owned', to: largest ? `/p/${largest.ref}` : undefined, id: 'eng-largest' },
        ]}
      />
      <Section id="eng-visual" title="This book at a glance" note={`Every owned project's ${vertical.name} bucket, or the book along the lifecycle with the active projects picked out`} defs={['bucket', 'workload']} definitions={definitions}>
        <ChartSwitch
          id="eng-visual"
          views={[
            { key: 'funnel', label: 'Activity funnel', render: () => <FunnelChart funnel={summary.funnel} id="eng-funnel-chart" unit="projects" /> },
            { key: 'stage', label: 'Book by stage', render: () => <StackedColumns id="eng-stage-chart" categories={categories} series={series} values={byStage.map((b) => b.count)} format={count} unit="projects" height={240} ariaLabel={`${engineer.name}'s book by stage. ${STAGES.map((st, i) => `${st}: ${count(byStage[i]!.count[0]! + byStage[i]!.count[1]!)}`).join('. ')}.`} /> },
            { key: 'stage-value', label: 'Value by stage', render: () => <StackedColumns id="eng-stage-chart" categories={categories} series={series} values={byStage.map((b) => b.value)} format={aedm} unit="AED m" height={240} ariaLabel={`${engineer.name}'s pipeline value by stage.`} /> },
          ]}
        />
      </Section>
      <Section id="eng-projects" title="Projects owned" note="The same table as the Projects page, pre-filtered to this book. Click a column to sort.">
        <VirtualTable rows={owned} sort={sort} onSort={(key, natural) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : natural }))} shown={new Set<SortKey>(['score'])} engineerName={engineerName} scoreIndex={vi} scoreName={vertical.name} height={Math.min(560, 60 + owned.length * 34)} />
      </Section>
      <div className="overview-grid">
        {(
          [
            ['Consultants', cons, 'consultant'],
            ['Contractors', cont, 'contractor'],
          ] as const
        ).map(([title, list, kind]) => (
          <Section key={kind} id={`eng-${kind}s`} title={title} note={`Held by ${engineer.name} or on their projects, by projects on this book`} compact link={{ to: `/parties?kind=${kind}`, label: 'All' }}>
            <div className="scroll-x">
              <table className="mis compact" id={`eng-${kind}-table`}>
                <thead>
                  <tr>
                    <th scope="col" className="left">
                      Name
                    </th>
                    <th scope="col" className="left">
                      Role
                    </th>
                    <th scope="col">On book</th>
                    <th scope="col">Rating</th>
                    <th scope="col" className="left">
                      Level
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(({ c, onBook }, i) => (
                    <motion.tr key={c.id} className="hov" {...rowReveal(i)}>
                      <th scope="row" className="left">
                        <Link to={`/parties?kind=${kind}&id=${c.id}`} className="elink">
                          {c.name}
                        </Link>
                      </th>
                      <td className="left">{roleLabel(kind, c.role)}</td>
                      <td className="num">{count(onBook)}</td>
                      <td className="num">{c.rating ?? <span className="muted">-</span>}</td>
                      <td className="left">{c.level ? c.level.replace(' management', '') : <span className="muted">none yet</span>}</td>
                    </motion.tr>
                  ))}
                  {list.length === 0 && (
                    <tr>
                      <td colSpan={5} className="left muted">
                        None recorded on this book.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        ))}
      </div>
      <Footer meta={meta} />
    </div>
  );
}

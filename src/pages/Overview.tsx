import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { BUCKETS, SECTORS, STAGES } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { aedm, count, pct, score } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise, useRowReveal } from '../components/Reveal';
import { StackedColumns } from '../components/StackedColumns';
import type { SegClass } from '../components/StackedColumns';
import { ChartSwitch } from '../components/ChartSwitch';
import { FunnelChart } from '../components/FunnelChart';

/** The sector fills, the family's ramp in order of register share. */
export const SECTOR_CLS: Record<string, SegClass> = { 'Urban Construction': 'spot', Industrial: 'ink', 'Oil, Gas and Fuels': 'spot2', Transport: 'ink2', Utilities: 'ink3' };
export const STAGE_SHORT: Record<string, string> = { Concept: 'Concept', Design: 'Design', Tender: 'Tender', 'Under Construction': 'Constr.', 'Completed (3 months)': 'Done 3m', 'Completed (1 year)': 'Done 1y', 'Completed (3 years)': 'Done 3y', 'Completed (above 3 years)': 'Done 3y+' };

/**
 * The overview answers what a managing director asks of a market: how big is it,
 * how much of it do we own, where does the value sit, what is worth chasing now,
 * who owns what, and how far has the activity gone. The headline figures first,
 * one full-width chart under them, then the detail.
 */
export default function Overview() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rise = useRise();
  const rowReveal = useRowReveal();
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading />;
  const { meta, kpis, definitions } = data;
  const engName = new Map(data.engineers.map((e) => [e.slug, e.name]));
  const registerValue = data.sectorStage.reduce((a, c) => a + Math.round(c.value * 10), 0) / 10;
  const maxOwned = Math.max(1, ...data.verticalSummary.map((v) => v.ownedValue));
  const sectorRows = SECTORS.map((sector) => {
    const cs = data.sectorStage.filter((c) => c.sector === sector);
    const value = cs.reduce((a, c) => a + Math.round(c.value * 10), 0) / 10;
    const n = cs.reduce((a, c) => a + c.count, 0);
    const top = [...cs].sort((a, b) => b.value - a.value)[0]!;
    return { sector, n, value, top };
  });
  const cell = (stage: string, sector: string) => data.sectorStage.find((c) => c.sector === sector && c.stage === stage) ?? { count: 0, value: 0 };
  const categories = STAGES.map((s) => ({ key: s, label: s, short: STAGE_SHORT[s] }));
  const series = SECTORS.map((s) => ({ key: s, label: s, cls: SECTOR_CLS[s]! }));
  const byValue = STAGES.map((st) => SECTORS.map((se) => cell(st, se).value));
  const byCount = STAGES.map((st) => SECTORS.map((se) => cell(st, se).count));
  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Overview</h1>
          <p className="page-sub">The market register, scored for Halvard, as of {meta.dataAsOfLabel}</p>
        </div>
        <p className="page-basis">
          Amounts in AED million to one decimal
          <br />
          {count(kpis.projects)} projects, AED {aedm(registerValue)} m in the register
        </p>
      </motion.div>

      <Strip
        id="kpis"
        label="Headline figures"
        cols={6}
        items={[
          { label: 'Projects in register', value: kpis.projects, f: count, sub: `AED ${aedm(registerValue)} m across ${count(data.matrix.length)} type rows`, to: '/projects', id: 'kpi-projects' },
          { label: 'Projects owned', value: kpis.owned, f: count, sub: `${pct((kpis.owned / kpis.projects) * 100)} of the register, ${data.engineers.length} engineers`, to: '/projects?owned=1', id: 'kpi-owned' },
          { label: 'Pipeline value owned', value: kpis.ownedValue, sub: `AED million, ${pct((kpis.ownedValue / registerValue) * 100)} of register value`, to: '/projects?owned=1&sort=value', id: 'kpi-value' },
          { label: 'Open enquiries and quotes', value: kpis.openEnquiriesAndQuotes, f: count, sub: 'project and vertical pairs live now', to: '/projects?bucket=1|2', id: 'kpi-open' },
          { label: `Orders received ${meta.fiscalYear}`, value: kpis.ordersThisYear, f: count, sub: `of ${count(data.funnel[0]!)} orders on record`, to: `/projects?bucket=0&year=${meta.fiscalYear}`, id: 'kpi-orders' },
          { label: 'Worth chasing now', value: data.chase.length, f: count, sub: `AED ${aedm(data.chase.reduce((a, c) => a + Math.round(c.value * 10), 0) / 10)} m, top twenty by value`, to: '#chase', id: 'kpi-chase' },
        ]}
      />

      <Section id="sector-stage" title="Where the value sits" note="Register value by stage of the project lifecycle, stacked by sector. Concept on the left, completed on the right." link={{ to: '/projects', label: 'All projects' }} defs={['register', 'value']} definitions={definitions}>
        <ChartSwitch
          id="sector-stage"
          views={[
            { key: 'value', label: 'Value, AED m', render: () => <StackedColumns id="sector-stage-chart" categories={categories} series={series} values={byValue} format={aedm} unit="AED m" ariaLabel={`Register value by stage and sector. ${STAGES.map((s, i) => `${s}: AED ${aedm(byValue[i]!.reduce((a, b) => a + b, 0))} million`).join('. ')}.`} /> },
            { key: 'count', label: 'Projects', render: () => <StackedColumns id="sector-stage-chart" categories={categories} series={series} values={byCount} format={count} unit="projects" ariaLabel={`Projects by stage and sector. ${STAGES.map((s, i) => `${s}: ${count(byCount[i]!.reduce((a, b) => a + b, 0))}`).join('. ')}.`} /> },
            { key: 'share', label: 'Sector share', render: () => <StackedColumns id="sector-stage-chart" categories={categories} series={series} values={byValue} format={aedm} unit="AED m" mode="share" ariaLabel="Sector share of value at each stage." /> },
          ]}
        />
      </Section>

      <div className="overview-grid">
        <Section id="verticals" title="Who owns what" note="Owned projects and pipeline value by vertical, AED million" link={{ to: '/engineers', label: 'Engineers' }} defs={['owner', 'pipeline']} definitions={definitions} compact>
          <div className="scroll-x">
            <table className="mis compact" id="vertical-table">
              <thead>
                <tr>
                  <th scope="col" className="left">
                    Vertical
                  </th>
                  <th scope="col">Eng.</th>
                  <th scope="col">Owned</th>
                  <th scope="col">AED m</th>
                  <th scope="col" className="left" aria-label="Pipeline value as a bar" />
                </tr>
              </thead>
              <tbody>
                {data.verticalSummary.map((v, i) => (
                  <motion.tr key={v.slug} className="hov" {...rowReveal(i)}>
                    <th scope="row" className="left">
                      <Link to={`/projects?v=${v.slug}&floor=4`} className="elink">
                        {v.name}
                      </Link>
                    </th>
                    <td className="num">{v.engineers}</td>
                    <td className="num">{count(v.owned)}</td>
                    <td className="num">{aedm(v.ownedValue)}</td>
                    <td className="left barcell">
                      <motion.span className="bar spot" style={{ width: `${Math.max(1, (100 * v.ownedValue) / maxOwned)}%`, transformOrigin: '0 50%' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, delay: 0.1 + i * 0.04 }} aria-hidden="true" />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="sectors" title="Largest stage by sector" note="Where each sector's value is concentrated, AED million" link={{ to: '/relevance', label: 'Relevance matrix' }} defs={['register']} definitions={definitions} compact>
          <div className="scroll-x">
            <table className="mis compact" id="sector-table">
              <thead>
                <tr>
                  <th scope="col" className="left">
                    Sector
                  </th>
                  <th scope="col">Projects</th>
                  <th scope="col">AED m</th>
                  <th scope="col" className="left">
                    Largest stage by value
                  </th>
                </tr>
              </thead>
              <tbody>
                {sectorRows.map((r, i) => (
                  <motion.tr key={r.sector} className="hov" {...rowReveal(i)}>
                    <th scope="row" className="left">
                      <Link to={`/projects?sector=${encodeURIComponent(r.sector)}`} className="elink">
                        <i className={`sw c-${SECTOR_CLS[r.sector]}`} aria-hidden="true" /> {r.sector}
                      </Link>
                    </th>
                    <td className="num">{count(r.n)}</td>
                    <td className="num">{aedm(r.value)}</td>
                    <td className="left">
                      {r.top.stage}, AED {aedm(r.top.value)} m ({pct((r.top.value / r.value) * 100, 0)})
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section id="chase" title="Worth chasing now" note={`Top twenty by value: Tender or under construction at ${data.buyingCompletionFloorPct.toFixed(1)} percent or less, overall relevance ${(5).toFixed(1)} or more, no vertical closed`} link={{ to: '/projects?stage=Tender|Under Construction&cmax=5&sort=value', label: 'Open the filtered register' }} defs={['chase', 'door', 'overall']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis compact sticky" id="chase-table">
            <thead>
              <tr>
                <th scope="col" className="left">
                  Project
                </th>
                <th scope="col" className="left">
                  Stage
                </th>
                <th scope="col">AED m</th>
                <th scope="col">Relev.</th>
                <th scope="col" className="left">
                  City
                </th>
                <th scope="col" className="left">
                  Type
                </th>
                <th scope="col" className="left">
                  Owner
                </th>
                <th scope="col" className="left">
                  Door in
                </th>
              </tr>
            </thead>
            <tbody>
              {data.chase.map((c, i) => (
                <motion.tr key={c.ref} className="hov" {...rowReveal(i)}>
                  <th scope="row" className="left">
                    <Link to={`/p/${c.ref}`} className="elink">
                      {c.name}
                    </Link>
                  </th>
                  <td className="left nowrap">
                    {c.stage}
                    {c.completionPct != null && c.completionPct > 0 ? `, ${pct(c.completionPct)}` : ''}
                  </td>
                  <td className="num">{aedm(c.value)}</td>
                  <td className="num">{score(c.overall)}</td>
                  <td className="left">{c.city}</td>
                  <td className="left">{c.type}</td>
                  <td className="left">{c.ownerEngineer ? <Link to={`/engineers/${c.ownerEngineer}`} className="elink">{engName.get(c.ownerEngineer)}</Link> : <span className="muted">none</span>}</td>
                  <td className="left">{c.door ? <Link to={`/parties?kind=${c.door.kind}&id=${c.door.id}`} className="elink">{c.door.name}</Link> : <span className="muted">no party recorded</span>}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="funnel" title="How far the activity has gone" note={`Every project and vertical pair in one of ${BUCKETS.length} buckets, highest priority first`} link={{ to: '/data-basis#buckets', label: 'The bucket rule' }} defs={['bucket', 'open', 'orders']} definitions={definitions}>
        <FunnelChart funnel={data.funnel} id="funnel-chart" />
        <p className="sec-note" id="funnel-projects">
          Counting each project once by its best bucket: {count(data.funnelProjects[0]!)} with an order, {count(data.funnelProjects[1]! + data.funnelProjects[2]!)} at quote or enquiry, {count(data.funnelProjects[4]!)} closed, {count(data.funnelProjects[10]!)} silent on every vertical.
        </p>
      </Section>

      <Footer meta={meta} />
    </div>
  );
}

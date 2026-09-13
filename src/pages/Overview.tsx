import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { BUCKETS, SECTORS } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { aedm, count, pct, score } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise, useRowReveal } from '../components/Reveal';
import { SectorStageChart } from '../components/SectorStageChart';
import { FunnelChart } from '../components/FunnelChart';

/**
 * The overview answers what a managing director asks of a market: how big is it,
 * how much of it do we own, what is worth chasing now, who owns what, and how far
 * has the activity gone. One block per question, every block linking to its page.
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
          { label: 'Projects in register', value: kpis.projects, f: count, sub: `${count(data.matrix.length)} type rows, ${count(data.parties.owners)} developers`, to: '/projects', id: 'kpi-projects' },
          { label: 'Projects owned', value: kpis.owned, f: count, sub: `${pct((kpis.owned / kpis.projects) * 100)} of the register`, to: '/engineers', id: 'kpi-owned' },
          { label: 'Pipeline value owned', value: kpis.ownedValue, sub: 'AED million, owned projects', to: '/projects?sort=value', id: 'kpi-value' },
          { label: 'Open enquiries and quotes', value: kpis.openEnquiriesAndQuotes, f: count, sub: 'project and vertical pairs', to: '/projects?bucket=1|2', id: 'kpi-open' },
          { label: `Orders received ${meta.fiscalYear}`, value: kpis.ordersThisYear, f: count, sub: 'project and vertical pairs', to: '/projects?bucket=0', id: 'kpi-orders' },
          { label: 'No owner', value: kpis.unowned, f: count, sub: 'held or out of scope', to: '/data-basis#cascade', id: 'kpi-unowned', bad: false },
        ]}
      />

      <div className="overview-grid">
        <Section id="sector-stage" title="Where the value sits" note="Register value by sector and stage, AED million" link={{ to: '/projects', label: 'All projects' }} defs={['register', 'value']} definitions={definitions} compact>
          <SectorStageChart cells={data.sectorStage} id="sector-stage-chart" />
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
                        {r.sector}
                      </Link>
                    </th>
                    <td className="num">{count(r.n)}</td>
                    <td className="num">{aedm(r.value)}</td>
                    <td className="left">
                      {r.top.stage}, AED {aedm(r.top.value)} m
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

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
                      <span className="bar" style={{ width: `${Math.max(1, (100 * v.ownedValue) / maxOwned)}%` }} aria-hidden="true" />
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

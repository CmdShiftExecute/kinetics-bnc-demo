import { useMemo } from 'react';
import { motion } from 'motion/react';
import { Link, useSearchParams } from 'react-router';
import type { Party, PartyKind, PartyRole } from '../../data/schema';
import { STAGES } from '../../data/schema';
import { useRegister } from '../lib/register';
import { aedm, count, cx, pct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise, useRowReveal } from '../components/Reveal';
import { PartyPicker, roleLabel } from '../components/PartyPicker';
import { Strip } from '../components/Strip';
import { Section } from '../components/Section';
import { HBars } from '../components/HBars';
import { ChartSwitch } from '../components/ChartSwitch';

/** The "who is the door in" page: pick a consultant or contractor and see its relationship, its projects, the verticals in play, and who it shares projects with. */
export default function PartiesPage() {
  const reg = useRegister();
  const [sp, setSp] = useSearchParams();
  const rise = useRise();
  const rowReveal = useRowReveal();
  const kind: PartyKind = sp.get('kind') === 'contractor' ? 'contractor' : 'consultant';
  const roleRaw = sp.get('role');
  const role: PartyRole | 'any' = roleRaw === 'lead' || roleRaw === 'mep' ? roleRaw : 'any';
  const id = Number(sp.get('id'));
  const list = reg.data ? (kind === 'consultant' ? reg.data.consultants : reg.data.contractors) : [];
  const party = useMemo(() => list.find((p) => p.id === id) ?? null, [list, id]);
  const put = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSp(next);
  };
  const projects = useMemo(() => (reg.data && party ? party.projects.map((r) => reg.data!.byRef.get(r)!).filter(Boolean).sort((a, b) => b.value - a.value) : []), [reg.data, party]);
  const shared = useMemo(() => {
    if (!reg.data || !party) return [];
    const counts = new Map<string, { p: Party; kind: PartyKind; n: number }>();
    for (const p of projects) {
      const cs = [...p.leadConsultants, ...(p.mepConsultant ? [p.mepConsultant] : [])].map((cid) => ({ kind: 'consultant' as const, p: reg.data!.consultantById.get(cid)! }));
      const ks = [...p.mainContractors, ...(p.mepContractor ? [p.mepContractor] : [])].map((cid) => ({ kind: 'contractor' as const, p: reg.data!.contractorById.get(cid)! }));
      for (const x of [...cs, ...ks]) {
        if (!x.p || (x.kind === kind && x.p.id === party.id)) continue;
        const key = `${x.kind}-${x.p.id}`;
        const cur = counts.get(key);
        if (cur) cur.n++;
        else counts.set(key, { p: x.p, kind: x.kind, n: 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.n - a.n || b.p.projectCount - a.p.projectCount).slice(0, 12);
  }, [reg.data, party, projects, kind]);
  if (reg.error) return <PageError message={reg.error} />;
  if (!reg.data) return <PageLoading rows={12} />;
  const { rollup } = reg.data;
  const { meta } = rollup;
  const engName = new Map(rollup.engineers.map((e) => [e.slug, e.name]));
  const ps = rollup.partySummary;
  const topRows = (mode: 'value' | 'count') =>
    (kind === 'consultant' ? ps.consultants : ps.contractors).top.map((t) => ({
      key: String(t.id),
      name: t.name,
      segments: [{ key: 'v', label: mode === 'value' ? 'Project value' : 'Projects', value: mode === 'value' ? t.projectValue : t.projectCount, cls: (kind === 'consultant' ? 'spot' : 'spot2') as 'spot' | 'spot2' }],
      end: mode === 'value' ? aedm(t.projectValue) : count(t.projectCount),
      endNote: mode === 'value' ? `${count(t.projectCount)} projects, ${t.level.replace(' management', '')}` : `AED ${aedm(t.projectValue)} m`,
    }));
  const stageMix = party ? STAGES.map((s) => ({ stage: s, n: projects.filter((p) => p.stage === s).length })).filter((x) => x.n > 0) : [];
  const roleOn = (p: (typeof projects)[number]): string => {
    if (!party) return '';
    if (kind === 'consultant') return [p.leadConsultants.includes(party.id) ? 'Lead' : '', p.mepConsultant === party.id ? 'MEP' : ''].filter(Boolean).join(' and ');
    return [p.mainContractors.includes(party.id) ? 'Main' : '', p.mepContractor === party.id ? 'MEP' : ''].filter(Boolean).join(' and ');
  };
  return (
    <div className="wrap wide">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Consultants and contractors</h1>
          <p className="page-sub">Who is the door in: the relationship Halvard holds with each firm, and the projects it sits on</p>
        </div>
        <p className="page-basis">
          {count(rollup.parties.consultants)} consultants, {count(rollup.parties.contractors)} contractors
          <br />
          Pick one on the left to read its card
        </p>
      </motion.div>
      <Strip
        id="party-kpis"
        label="Party headline figures"
        cols={6}
        items={[
          { label: 'Consultants', value: ps.consultants.total, f: count, sub: `${count(ps.consultants.senior)} at senior management, rating ${ps.consultants.averageRating.toFixed(1)} of 10`, to: '/parties?kind=consultant', id: 'pk-consultants' },
          { label: 'Contractors', value: ps.contractors.total, f: count, sub: `${count(ps.contractors.senior)} at senior management, rating ${ps.contractors.averageRating.toFixed(1)} of 10`, to: '/parties?kind=contractor', id: 'pk-contractors' },
          { label: 'Firms on ten or more projects', value: ps.consultants.onTenPlus + ps.contractors.onTenPlus, f: count, sub: `${count(ps.consultants.onTenPlus)} consultants, ${count(ps.contractors.onTenPlus)} contractors`, id: 'pk-tenplus' },
          { label: 'Largest book', value: (kind === 'consultant' ? ps.consultants : ps.contractors).top[0]?.projectValue ?? 0, sub: `AED m, ${(kind === 'consultant' ? ps.consultants : ps.contractors).top[0]?.name ?? ''}`, to: `/parties?kind=${kind}&id=${(kind === 'consultant' ? ps.consultants : ps.contractors).top[0]?.id ?? ''}`, id: 'pk-largest' },
          { label: 'Projects with no consultant', value: ps.projectsNoConsultant, f: count, sub: `${pct((ps.projectsNoConsultant / rollup.kpis.projects) * 100)} of the register`, id: 'pk-nocon' },
          { label: 'Open, no contractor yet', value: ps.openProjectsNoContractor, f: count, sub: `at Tender or early construction: still open to win`, to: '/projects?stage=Tender|Under Construction&cmax=5', id: 'pk-open', bad: false },
        ]}
      />
      <Section id="top-firms" title={kind === 'consultant' ? 'The consultants that matter most' : 'The contractors that matter most'} note="The twenty largest firms by the value of the projects they sit on. Click a bar to open the firm's card.">
        <ChartSwitch
          id={`top-${kind}`}
          views={[
            { key: 'value', label: 'Value, AED m', render: () => <HBars id="top-firms-chart" rows={topRows('value')} format={aedm} unit="AED m" onPick={(k) => put({ id: k })} activeKey={party ? String(party.id) : null} ariaLabel={`Top twenty ${kind}s by project value.`} /> },
            { key: 'count', label: 'Projects', render: () => <HBars id="top-firms-chart" rows={topRows('count')} format={count} unit="projects" onPick={(k) => put({ id: k })} activeKey={party ? String(party.id) : null} ariaLabel={`Top twenty ${kind}s by project count.`} /> },
          ]}
        />
      </Section>
      <div className="side parties">
        <PartyPicker kind={kind} role={role} list={list} selected={party?.id ?? null} onKind={(k) => put({ kind: k, id: null, role: null })} onRole={(r) => put({ role: r === 'any' ? null : r })} onPick={(pid) => put({ id: String(pid) })} />
        <div className="party-card" id="party-card" data-id={party?.id ?? ''} data-count={projects.length}>
          {!party ? (
            <div className="empty" id="party-empty">
              <strong>No {kind} selected.</strong> Choose one from the list to see its relationship level and rating, the engineer who owns it, the projects it sits on, the verticals in play, and the other firms it shares projects with.
            </div>
          ) : (
            <>
              <header className="party-head">
                <p className="label">
                  {roleLabel(kind, party.role)} {kind}
                </p>
                <h2 className="display sec-title" id="party-name">
                  {party.name}
                </h2>
              </header>
              <dl className="strip" style={{ '--cols': 4 } as React.CSSProperties} aria-label="Relationship">
                <div>
                  <dt>Relationship level</dt>
                  <dd className="big small">{party.level.replace(' management', '')}</dd>
                  <dd className="sub">management</dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd className="big">{party.rating}</dd>
                  <dd className="sub">of 10</dd>
                </div>
                <div>
                  <dt>Relationship owner</dt>
                  <dd className="big small">
                    <Link to={`/engineers/${party.owner}`} className="vlink">
                      {engName.get(party.owner)}
                    </Link>
                  </dd>
                  <dd className="sub">{rollup.verticals.find((v) => v.slug === rollup.engineers.find((e) => e.slug === party.owner)?.vertical)?.name}</dd>
                </div>
                <div>
                  <dt>Projects</dt>
                  <dd className="big">{count(party.projectCount)}</dd>
                  <dd className="sub">AED {aedm(party.projectValue)} m</dd>
                </div>
              </dl>
              <section className="sec compact" aria-labelledby="party-verticals">
                <header className="sec-head">
                  <div>
                    <h3 className="display sec-title" id="party-verticals">
                      Verticals in play
                    </h3>
                    <p className="sec-note">Graded Medium or High on its projects, most frequent first; stage mix of its projects beside</p>
                  </div>
                </header>
                <p className="tags">
                  {party.verticals.map((vi) => (
                    <Link key={vi} to={`/projects?${kind === 'consultant' ? 'con' : 'kon'}=${party.id}&v=${rollup.verticals[vi]!.slug}`} className="tag press">
                      {rollup.verticals[vi]!.name}
                    </Link>
                  ))}
                  {party.verticals.length === 0 && <span className="muted">None graded Medium or above.</span>}
                </p>
                <p className="muted" style={{ marginTop: 'var(--s-sm)' }}>
                  {stageMix.map((x) => `${x.stage} ${count(x.n)} (${pct((x.n / projects.length) * 100, 0)})`).join(' · ')}
                </p>
              </section>
              <section className="sec compact" aria-labelledby="party-projects">
                <header className="sec-head">
                  <div>
                    <h3 className="display sec-title" id="party-projects">
                      Projects it sits on
                    </h3>
                    <p className="sec-note">Largest first. Open any project for its full page.</p>
                  </div>
                  <Link to={`/projects?${kind === 'consultant' ? 'con' : 'kon'}=${party.id}`} className="sec-link press">
                    In the register {'>>>'}
                  </Link>
                </header>
                <div className="scroll-x">
                  <table className="mis compact" id="party-projects-table">
                    <thead>
                      <tr>
                        <th scope="col" className="left">
                          Project
                        </th>
                        <th scope="col" className="left">
                          Role
                        </th>
                        <th scope="col" className="left">
                          Stage
                        </th>
                        <th scope="col">AED m</th>
                        <th scope="col" className="left">
                          Owner
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((p, i) => (
                        <motion.tr key={p.ref} className="hov" {...rowReveal(i)}>
                          <th scope="row" className="left">
                            <Link to={`/p/${p.ref}`} className="elink">
                              {p.name}
                            </Link>
                          </th>
                          <td className="left">{roleOn(p)}</td>
                          <td className="left nowrap">{p.stage}</td>
                          <td className="num">{aedm(p.value)}</td>
                          <td className="left">{p.ownerEngineer ? engName.get(p.ownerEngineer) : <span className="muted">none</span>}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="sec compact" aria-labelledby="party-shared">
                <header className="sec-head">
                  <div>
                    <h3 className="display sec-title" id="party-shared">
                      Shares projects with
                    </h3>
                    <p className="sec-note">Other consultants and contractors on the same projects, by projects in common</p>
                  </div>
                </header>
                <ul className="items" id="party-shared-list">
                  {shared.map((s) => (
                    <li key={`${s.kind}-${s.p.id}`} className={cx(s.kind)}>
                      <Link to={`/parties?kind=${s.kind}&id=${s.p.id}`} className="elink">
                        {s.p.name}
                      </Link>
                      <span className="remark">
                        {roleLabel(s.kind, s.p.role)} {s.kind}
                      </span>
                      <span className="num">
                        {count(s.n)} in common
                      </span>
                    </li>
                  ))}
                  {shared.length === 0 && <li className="muted">No other firm is recorded on these projects.</li>}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
      <Footer meta={meta} />
    </div>
  );
}

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
import { PartyPicker, measureOf, roleLabel } from '../components/PartyPicker';
import type { RelFilter } from '../components/PartyPicker';
import { Strip } from '../components/Strip';
import { Section } from '../components/Section';
import { HBars } from '../components/HBars';
import { ChartSwitch } from '../components/ChartSwitch';

/** The address of the register filtered to buying-stage projects with no contractor: the same predicate the "Open, no contractor yet" figure counts. */
export const OPEN_NO_CONTRACTOR_LINK = '/projects?stage=Tender|Under Construction&cmax=5&nokon=1';

/**
 * The "who is the door in" page: pick a consultant or contractor and see its relationship
 * (or that there is none yet), its projects, every vertical in play with counts, and who
 * it shares projects with. The list and the top-firms chart rank on the whole book or on
 * one vertical, chosen in the address, so "which consultant matters most to Cooling" is
 * two clicks from the Overview.
 */
export default function PartiesPage() {
  const reg = useRegister();
  const [sp, setSp] = useSearchParams();
  const rise = useRise();
  const rowReveal = useRowReveal();
  const kind: PartyKind = sp.get('kind') === 'contractor' ? 'contractor' : 'consultant';
  const roleRaw = sp.get('role');
  const role: PartyRole | 'any' = roleRaw === 'lead' || roleRaw === 'mep' ? roleRaw : 'any';
  const relRaw = sp.get('rel');
  const rel: RelFilter = relRaw === 'held' || relRaw === 'none' ? relRaw : 'any';
  const id = Number(sp.get('id'));
  const verticals = reg.data?.rollup.verticals ?? [];
  const vRaw = sp.get('v');
  const vertical = vRaw && verticals.some((v) => v.slug === vRaw) ? vRaw : null;
  const vi = vertical ? verticals.findIndex((v) => v.slug === vertical) : null;
  const vName = vi !== null ? verticals[vi]!.name : null;
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
  /*
   * The top twenty of the CURRENT kind, ranked by the selected measure over the complete
   * party list (never a value-ranked twenty re-sorted by count): by value or by count, on
   * the whole book or on the chosen vertical. Derived from the loaded party file, which
   * the reconciliation ties to the register firm by firm.
   */
  const ranked = useMemo(() => {
    const rows = list.map((p) => ({ p, m: measureOf(p, vi) })).filter((r) => r.m.n > 0);
    const byValue = [...rows].sort((a, b) => b.m.value - a.m.value || b.m.n - a.m.n || a.p.id - b.p.id).slice(0, 20);
    const byCount = [...rows].sort((a, b) => b.m.n - a.m.n || b.m.value - a.m.value || a.p.id - b.p.id).slice(0, 20);
    return { byValue, byCount };
  }, [list, vi]);
  if (reg.error) return <PageError message={reg.error} />;
  if (!reg.data) return <PageLoading rows={12} />;
  const { rollup } = reg.data;
  const { meta } = rollup;
  const engName = new Map(rollup.engineers.map((e) => [e.slug, e.name]));
  const ps = rollup.partySummary;
  const noRel = ps.consultants.noRelationship + ps.contractors.noRelationship;
  const noRelValue = Math.round((ps.consultants.noRelationshipValue + ps.contractors.noRelationshipValue) * 10) / 10;
  const largest = (kind === 'consultant' ? ps.consultants : ps.contractors).top[0];
  const topRows = (mode: 'value' | 'count') =>
    (mode === 'value' ? ranked.byValue : ranked.byCount).map(({ p, m }) => ({
      key: String(p.id),
      name: p.name,
      segments: [{ key: 'v', label: mode === 'value' ? (vName ? `Value on ${vName}` : 'Project value') : vName ? `Projects on ${vName}` : 'Projects', value: mode === 'value' ? m.value : m.n, cls: (kind === 'consultant' ? 'spot' : 'spot2') as 'spot' | 'spot2' }],
      end: mode === 'value' ? aedm(m.value) : count(m.n),
      endNote: mode === 'value' ? `${count(m.n)} projects, ${p.level ? p.level.replace(' management', '') : 'no relationship'}` : `AED ${aedm(m.value)} m`,
    }));
  const stageMix = party ? STAGES.map((s) => ({ stage: s, n: projects.filter((p) => p.stage === s).length })).filter((x) => x.n > 0) : [];
  const roleOn = (p: (typeof projects)[number]): string => {
    if (!party) return '';
    if (kind === 'consultant') return [p.leadConsultants.includes(party.id) ? 'Lead' : '', p.mepConsultant === party.id ? 'MEP' : ''].filter(Boolean).join(' and ');
    return [p.mainContractors.includes(party.id) ? 'Main' : '', p.mepContractor === party.id ? 'MEP' : ''].filter(Boolean).join(' and ');
  };
  /* every vertical in play, with its count: the whole list, most frequent first, the chosen vertical first of all */
  const inPlay = party
    ? party.verticalCounts
        .map((n, i) => ({ i, n, value: party.verticalValues[i]!, name: verticals[i]!.name, slug: verticals[i]!.slug }))
        .filter((x) => x.n > 0)
        .sort((a, b) => (a.i === vi ? -1 : b.i === vi ? 1 : 0) || b.n - a.n || a.i - b.i)
    : [];
  const partyLink = (extra = '') => `/projects?${kind === 'consultant' ? 'con' : 'kon'}=${party?.id ?? ''}${extra}`;
  const vq = vertical ? `&v=${vertical}` : '';
  const onV = party && vi !== null ? measureOf(party, vi) : null;
  return (
    <div className="wrap wide">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Consultants and contractors</h1>
          <p className="page-sub">Relationships that open the door to projects</p>
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
          { label: 'No relationship yet', value: noRel, f: count, sub: <><Link className="vlink" to="/parties?kind=consultant&rel=none">{count(ps.consultants.noRelationship)} consultants</Link>{' · '}<Link className="vlink" to="/parties?kind=contractor&rel=none">{count(ps.contractors.noRelationship)} contractors</Link><br />AED {aedm(noRelValue)} m summed across firm books; shared projects counted more than once.</>, id: 'pk-norel' },
          { label: 'Largest book', value: largest?.projectValue ?? 0, sub: `AED m, ${largest?.name ?? ''}`, to: `/parties?kind=${kind}&id=${largest?.id ?? ''}`, id: 'pk-largest' },
          { label: 'Projects with no consultant', value: ps.projectsNoConsultant, f: count, sub: `${pct((ps.projectsNoConsultant / rollup.kpis.projects) * 100)} of the register`, to: '/projects?nocon=1', id: 'pk-nocon' },
          { label: 'Open, no contractor yet', value: ps.openProjectsNoContractor, f: count, sub: `at Tender or early construction: still open to win`, to: OPEN_NO_CONTRACTOR_LINK, id: 'pk-open', bad: false },
        ]}
      />
      <Section id="top-firms" title={`The ${kind}s that matter most${vName ? ` to ${vName}` : ''}`} note={vName ? `The twenty ${kind}s with the most projects graded Medium or High on ${vName}, or the most value there. Click a bar to open the firm's card.` : `The twenty largest ${kind}s by the value of the projects they sit on, or by their count; the two lists differ. Click a bar to open the firm's card.`}>
        <ChartSwitch
          id={`top-${kind}`}
          views={[
            { key: 'value', label: 'Value, AED m', render: () => <HBars id="top-firms-chart" rows={topRows('value')} format={aedm} unit="AED m" onPick={(k) => put({ id: k })} activeKey={party ? String(party.id) : null} ariaLabel={`Top twenty ${kind}s by project value${vName ? ` on ${vName}` : ''}.`} /> },
            { key: 'count', label: 'Projects', render: () => <HBars id="top-firms-chart" rows={topRows('count')} format={count} unit="projects" onPick={(k) => put({ id: k })} activeKey={party ? String(party.id) : null} ariaLabel={`Top twenty ${kind}s by project count${vName ? ` on ${vName}` : ''}.`} /> },
          ]}
        />
      </Section>
      <div className="side parties">
        <PartyPicker kind={kind} role={role} rel={rel} vertical={vertical} verticals={verticals} list={list} selected={party?.id ?? null} onKind={(k) => put({ kind: k, id: null, role: null })} onRole={(r) => put({ role: r === 'any' ? null : r })} onRel={(r) => put({ rel: r === 'any' ? null : r })} onVertical={(slug) => put({ v: slug })} onPick={(pid) => put({ id: String(pid) })} />
        <div className="party-card" id="party-card" data-id={party?.id ?? ''} data-count={projects.length} data-rel={party ? (party.level ? 'held' : 'none') : ''}>
          {!party ? (
            <div className="empty" id="party-empty">
              <strong>No {kind} selected.</strong> Choose one from the list to see its relationship level and rating, the engineer who owns it, the projects it sits on, every vertical in play with its count, and the other firms it shares projects with.
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
              {party.level ? (
                <dl className="strip" style={{ '--cols': 4 } as React.CSSProperties} aria-label="Relationship" id="party-rel">
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
                        {engName.get(party.owner!)}
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
              ) : (
                <dl className="strip norel" style={{ '--cols': 4 } as React.CSSProperties} aria-label="Relationship" id="party-rel">
                  <div>
                    <dt>Relationship level</dt>
                    <dd className="big small">None yet</dd>
                    <dd className="sub">Halvard has not worked with this firm</dd>
                  </div>
                  <div>
                    <dt>Rating</dt>
                    <dd className="big">-</dd>
                    <dd className="sub">not rated</dd>
                  </div>
                  <div>
                    <dt>Relationship owner</dt>
                    <dd className="big small">None</dd>
                    <dd className="sub">{inPlay[0] ? `${inPlay[0].name} would own it` : 'no vertical in play'}</dd>
                  </div>
                  <div>
                    <dt>Projects</dt>
                    <dd className="big">{count(party.projectCount)}</dd>
                    <dd className="sub">AED {aedm(party.projectValue)} m</dd>
                  </div>
                </dl>
              )}
              <section className="sec compact" aria-labelledby="party-verticals">
                <header className="sec-head">
                  <div>
                    <h3 className="display sec-title" id="party-verticals">
                      Verticals in play
                    </h3>
                    <p className="sec-note">
                      All {count(inPlay.length)} of {verticals.length} verticals graded Medium or High on this firm's projects, with the project count on each, most frequent first{vName ? `; ${vName} first` : ''}. Stage mix of its projects beneath.
                    </p>
                  </div>
                </header>
                <p className="tags" id="party-vertical-tags" data-count={inPlay.length}>
                  {inPlay.map((x) => (
                    <Link key={x.slug} to={partyLink(`&v=${x.slug}`)} className={cx('tag press', x.i === vi && 'on')} data-slug={x.slug} data-n={x.n}>
                      {x.name} <b>{count(x.n)}</b>
                    </Link>
                  ))}
                  {inPlay.length === 0 && <span className="muted">None graded Medium or above.</span>}
                </p>
                {onV && vName && (
                  <p className="muted" id="party-on-vertical" style={{ marginTop: 'var(--s-sm)' }}>
                    On {vName}: {count(onV.n)} of {count(party.projectCount)} projects, AED {aedm(onV.value)} m.
                  </p>
                )}
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
                  <Link to={partyLink(vq)} className="sec-link press">
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
                      <Link to={`/parties?kind=${s.kind}&id=${s.p.id}${vq}`} className="elink">
                        {s.p.name}
                      </Link>
                      <span className="remark">
                        {roleLabel(s.kind, s.p.role)} {s.kind}
                        {s.p.level === null ? ', no relationship yet' : ''}
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

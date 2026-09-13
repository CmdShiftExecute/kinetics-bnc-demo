import { motion } from 'motion/react';
import { Link, useParams } from 'react-router';
import { bestBucket, gateWords, gradeOf } from '../../data/rules';
import { BUCKETS } from '../../data/schema';
import { useRegister } from '../lib/register';
import { count, cx, dateLabel, pct, score } from '../lib/format';
import { Crumbs, Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise, useRowReveal } from '../components/Reveal';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { ScoreStrip } from '../components/ScoreStrip';

/**
 * Everything about one project: six figures, the ten scores full width directly beneath
 * them, then identity and the four parties, the owner and why (the cascade step by step,
 * with the tie decision as it was actually recorded), the activity per vertical, and the
 * description.
 */
export default function ProjectPage() {
  const { ref } = useParams();
  const reg = useRegister();
  const rise = useRise();
  const rowReveal = useRowReveal();
  if (reg.error) return <PageError message={reg.error} />;
  if (!reg.data) return <PageLoading rows={12} />;
  const { rollup } = reg.data;
  const p = ref ? reg.data.byRef.get(ref.toUpperCase()) : undefined;
  if (!p) return <PageError message={`No such project: "${ref}". References look like HV-26-00001; every project is listed on the Projects page.`} back={{ to: '/projects', label: 'Back to the projects' }} />;
  const { meta, verticals, definitions } = rollup;
  const engName = new Map(rollup.engineers.map((e) => [e.slug, e.name]));
  const ownerV = p.ownerVertical != null ? verticals[p.ownerVertical]! : null;
  const cons = (ids: number[]) => ids.map((id) => reg.data!.consultantById.get(id)).filter((c) => c !== undefined);
  const kons = (ids: number[]) => ids.map((id) => reg.data!.contractorById.get(id)).filter((c) => c !== undefined);
  const why = p.why;
  const best = bestBucket(p.buckets);
  const bestOn = p.buckets.map((b, i) => (b === best ? verticals[i]!.name : null)).filter((x): x is string => x !== null);
  /* the tie sentence is rendered from the decision record, never inferred: "fewer" only when the winner's count was strictly the lowest, "order" when the counts were equal */
  const tieWords = (() => {
    if (!why.tie || why.tieRule === null) return '';
    const counts = why.tied.map((v, i) => `${verticals[v]!.name} ${count(why.assignedAtDecision[i]!)}`).join(', ');
    if (why.tieRule === 'fewer') return `, chosen on the tie rule because it had fewer projects assigned at the time (${counts})`;
    return `, chosen on the tie rule: ${why.tied.length === 2 ? 'both' : 'all'} had the same number of projects assigned at the time (${counts}), so the earlier vertical in the published order won`;
  })();
  const whyWords = (() => {
    const eligible = why.eligible.map((i) => `${verticals[i]!.name} (${score(p.scores[i]!)})`);
    const parts = [`Step 1, scope floor: ${eligible.length ? `${eligible.length} vertical${eligible.length === 1 ? '' : 's'} at ${rollup.scopeFloor.toFixed(1)} or more, ${eligible.join(', ')}` : `no vertical scores ${rollup.scopeFloor.toFixed(1)} or more`}.`];
    parts.push(`Step 2, stage gate: the project is ${gateWords(why.gate)}.`);
    if (why.candidates.length) {
      const cands = why.candidates.map((i) => `${verticals[i]!.name} (${score(p.scores[i]!)})`);
      parts.push(`Step 3, highest score: ${cands.length === 1 ? `only ${cands[0]} passes the gate` : `${cands.join(', ')} pass the gate; ${ownerV!.name} has the highest score${tieWords}`}.`);
      parts.push(`Step 4, lowest pipeline: ${engName.get(p.ownerEngineer!)} had the lowest pipeline value on ${ownerV!.name} when this project was assigned, in reference order.`);
    } else parts.push('Step 5: no vertical passes, so the project has no owner and counts in the unassigned figure.');
    return parts;
  })();
  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <Crumbs items={[{ to: '/projects', label: 'Projects' }, { label: p.ref }]} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <p className="label">{p.ref}</p>
          <h1 className="display page-title">{p.name}</h1>
          <p className="page-sub">
            {p.type}, {p.industry}, {p.sector}. {p.city}. {p.category}.
          </p>
        </div>
        <p className="page-basis">
          Last updated {dateLabel(p.lastUpdated)}
          <br />
          {p.stage.startsWith('Completed') ? 'Completed' : 'Expected completion'} {dateLabel(p.completionDate)}
        </p>
      </motion.div>
      <Strip
        id="p-strip"
        cols={6}
        label="Project figures"
        items={[
          { label: 'Value', value: p.value, sub: 'AED million', id: 'p-value' },
          { label: 'Stage', value: 0, f: () => p.stage, text: true, sub: p.completionPct != null ? `${pct(p.completionPct)} complete` : 'not under construction', id: 'p-stage' },
          { label: 'Overall relevance', value: p.overall ?? 0, f: (n) => (p.overall == null ? 'none' : n.toFixed(1)), sub: p.overall == null ? 'no graded vertical' : `${gradeOf(p.overall)}, highest of ten`, id: 'p-overall' },
          { label: 'Verticals in scope', value: why.eligible.length, f: count, sub: `of ${verticals.length} score ${rollup.scopeFloor.toFixed(1)} or more; ${count(why.candidates.length)} pass the stage gate`, id: 'p-eligible' },
          { label: 'Owner', value: 0, f: () => (p.ownerEngineer ? (engName.get(p.ownerEngineer) ?? '') : 'None'), text: true, sub: ownerV ? ownerV.name : why.gate === 'held' ? 'held: no contractor appointed' : 'no eligible vertical', to: p.ownerEngineer ? `/engineers/${p.ownerEngineer}` : undefined, id: 'p-owner' },
          { label: 'Best activity', value: 0, f: () => BUCKETS[best]!, text: true, sub: `on ${bestOn.length === verticals.length ? 'every vertical' : bestOn.slice(0, 2).join(' and ')}${bestOn.length > 2 && bestOn.length < verticals.length ? ` and ${count(bestOn.length - 2)} more` : ''}`, bad: best === 4, id: 'p-best' },
        ]}
      />
      <Section id="scores" title="Relevance by vertical" note="Score out of 8.0 with its grade; the owning vertical is outlined; an asterisk marks a hand-adjusted score" defs={['relevance', 'overall']} definitions={definitions}>
        <ScoreStrip verticals={verticals} scores={p.scores} adjusted={p.adjusted} owner={p.ownerVertical} id="score-strip" />
      </Section>
      <div className="overview-grid">
        <Section id="identity" title="Identity" compact defs={['value', 'completion']} definitions={definitions}>
          <dl className="basis-list">
            <div>
              <dt>Sector</dt>
              <dd>
                <Link to={`/projects?sector=${encodeURIComponent(p.sector)}`} className="elink">
                  {p.sector}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Industry</dt>
              <dd>
                <Link to={`/projects?industry=${encodeURIComponent(p.industry)}`} className="elink">
                  {p.industry}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Project type</dt>
              <dd>
                <Link to={`/projects?type=${encodeURIComponent(p.type)}`} className="elink">
                  {p.type}
                </Link>
              </dd>
            </div>
            <div>
              <dt>Attributes</dt>
              <dd>{p.attributes.length ? p.attributes.join(', ') : 'none recorded'}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{p.category}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{p.city}, United Arab Emirates</dd>
            </div>
            <div>
              <dt>Completion</dt>
              <dd>
                {p.completionPct == null ? 'not recorded, not under construction' : pct(p.completionPct)}; {p.stage.startsWith('Completed') ? 'completed' : 'expected'} {dateLabel(p.completionDate)}
              </dd>
            </div>
          </dl>
        </Section>
        <Section id="parties" title="The parties" compact defs={['door']} definitions={definitions} note="Each name opens its relationship card">
          <dl className="basis-list" id="party-list">
            <div>
              <dt>Owner or developer</dt>
              <dd>{p.owners.length ? p.owners.map((id) => reg.data!.ownerById.get(id)?.name ?? `#${id}`).join('; ') : <span className="muted">not recorded</span>}</dd>
            </div>
            <div>
              <dt>Lead or design consultant</dt>
              <dd>
                {cons(p.leadConsultants).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && '; '}
                    <Link to={`/parties?kind=consultant&id=${c.id}`} className="elink">
                      {c.name}
                    </Link>
                  </span>
                ))}
                {p.leadConsultants.length === 0 && <span className="muted">not recorded</span>}
              </dd>
            </div>
            <div>
              <dt>MEP consultant</dt>
              <dd>{p.mepConsultant != null ? <Link to={`/parties?kind=consultant&id=${p.mepConsultant}`} className="elink">{reg.data.consultantById.get(p.mepConsultant)?.name}</Link> : <span className="muted">not recorded</span>}</dd>
            </div>
            <div>
              <dt>Main or EPC contractor</dt>
              <dd>
                {kons(p.mainContractors).map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && '; '}
                    <Link to={`/parties?kind=contractor&id=${c.id}`} className="elink">
                      {c.name}
                    </Link>
                  </span>
                ))}
                {p.mainContractors.length === 0 && <span className="muted">not appointed</span>}
              </dd>
            </div>
            <div>
              <dt>MEP contractor</dt>
              <dd>{p.mepContractor != null ? <Link to={`/parties?kind=contractor&id=${p.mepContractor}`} className="elink">{reg.data.contractorById.get(p.mepContractor)?.name}</Link> : <span className="muted">not appointed</span>}</dd>
            </div>
          </dl>
        </Section>
      </div>
      <Section id="owner" title="Who owns it, and why" note="The ownership cascade, step by step, as the generator applied it; a tie names the counts it was decided on" defs={['owner']} definitions={definitions} link={{ to: '/data-basis#cascade', label: 'The cascade' }}>
        <ol className="policy" id="why" data-tie={why.tieRule ?? 'none'}>
          {whyWords.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
        {p.ownerEngineer && (
          <Link to={`/engineers/${p.ownerEngineer}`} className="drill-link press">
            Open {engName.get(p.ownerEngineer)}'s book
          </Link>
        )}
      </Section>
      <Section id="activity" title="Activity by vertical" note="One bucket per vertical, chosen by priority, with the date of the last activity" defs={['bucket']} definitions={definitions}>
        <div className="scroll-x">
          <table className="mis compact" id="activity-table">
            <thead>
              <tr>
                <th scope="col" className="left">
                  Vertical
                </th>
                <th scope="col">Score</th>
                <th scope="col" className="left">
                  Grade
                </th>
                <th scope="col" className="left">
                  Bucket
                </th>
                <th scope="col" className="left">
                  Last activity
                </th>
              </tr>
            </thead>
            <tbody>
              {verticals.map((v, i) => (
                <motion.tr key={v.slug} className={cx('hov', p.ownerVertical === i && 'eng')} {...rowReveal(i)}>
                  <th scope="row" className="left">
                    {v.name}
                    {p.ownerVertical === i ? ' (owner)' : ''}
                  </th>
                  <td className="num">{score(p.scores[i]!)}</td>
                  <td className="left">{gradeOf(p.scores[i]!) ?? 'none'}</td>
                  <td className={cx('left', p.buckets[i] === 4 && 'bad')}>{BUCKETS[p.buckets[i]!]}</td>
                  <td className="left">{dateLabel(p.bucketDates[i]!)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="description" title="Description">
        <p id="p-description">{p.description}</p>
        <p className="muted" style={{ fontSize: 11 }}>
          Synthetic record {p.ref} of {count(rollup.kpis.projects)}. Every figure above traces to the generator and is reconciled on the Data basis page.
        </p>
      </Section>
      <Footer meta={meta} />
    </div>
  );
}

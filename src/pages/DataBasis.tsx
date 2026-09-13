import { useState } from 'react';
import { motion } from 'motion/react';
import type { Reconciliation, Rollup } from '../../data/schema';
import { BUCKETS } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateReconciliation, validateRollup } from '../lib/validate';
import { aedm, count, cx, pct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise, useRowReveal } from '../components/Reveal';

/** The generator's assumptions, the grade scale, the ownership cascade, the bucket priority, the precision policy, and the machine's own reconciliation. */
export default function DataBasis() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rec = useJson<Reconciliation>('reconciliation.json', validateReconciliation);
  const rise = useRise();
  const rowReveal = useRowReveal();
  const [openCat, setOpenCat] = useState<string | null>(null);
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading rows={12} />;
  const { meta, definitions, precisionPolicy, assumptions, cascade, bucketRule, gradeScore } = data;
  const failed = rec.data ? rec.data.assertions.filter((a) => !a.pass) : [];
  const fmt = (n: number) => (Number.isInteger(n) ? count(n) : aedm(n));
  const total = data.sectorStage.reduce((a, c) => a + Math.round(c.value * 10), 0) / 10;
  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Data basis</h1>
          <p className="page-sub">Where every figure comes from, the rules that produce it, and the machine's own check that the tables agree</p>
        </div>
        <p className="page-basis">
          Register as of {meta.dataAsOfLabel}, seed {meta.seed}
          <br />
          Synthetic data; nothing here is a real project, firm or person
        </p>
      </motion.div>

      {rec.data && (
        <Strip
          id="rec-strip"
          cols={3}
          label="Reconciliation"
          items={[
            { label: 'Assertions checked', value: rec.data.assertions.length, f: count, sub: `${rec.data.categories.length} categories`, id: 'rec-checked' },
            { label: 'Passing', value: rec.data.passed, f: count, sub: 'every figure tied to every other', id: 'rec-passed' },
            { label: 'Failing', value: rec.data.failed, f: count, sub: rec.data.failed === 0 ? 'the tables agree' : 'listed first below', bad: rec.data.failed > 0, id: 'rec-failed' },
          ]}
        />
      )}

      <Section id="reporting-basis" title="Reporting basis">
        <dl className="basis-list">
          <div>
            <dt>Company</dt>
            <dd>
              {meta.company}, {meta.division}. A fictional group; all data is synthetic.
            </dd>
          </div>
          <div>
            <dt>Register</dt>
            <dd>
              {count(data.kpis.projects)} projects worth AED {aedm(total)} m, stated as of {meta.dataAsOfLabel}; {count(data.parties.consultants)} consultants, {count(data.parties.contractors)} contractors and {count(data.parties.owners)} developers appear on at least one project.
            </dd>
          </div>
          <div>
            <dt>Units</dt>
            <dd>Money in AED million to one decimal. Percentages to one decimal. Scores 0.0 to 8.0. Counts whole.</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>Every date is a calendar date in GST (Asia/Dubai). No published file carries a generation timestamp, so a re-run writes identical bytes.</dd>
          </div>
        </dl>
      </Section>

      <Section id="grades" title="The relevance grade scale" note="How a project gets its ten scores" defs={['relevance', 'overall']} definitions={definitions}>
        <p>
          The relevance matrix has one row per sector, industry and project type ({count(data.matrix.length)} rows) and one column per vertical. Each cell is High, Medium, Low or none. Grades convert to numbers: High {gradeScore.High.toFixed(1)}, Medium {gradeScore.Medium.toFixed(1)}, Low {gradeScore.Low.toFixed(1)}, none blank. A project's score for a vertical is looked up by its project type when it enters the register and never changes with stage or location. About eight percent of rows carry a hand-adjusted score between the grades, shown to one decimal and marked on the project page. Overall relevance is the highest of the ten.
        </p>
      </Section>

      <Section id="cascade" title="The ownership cascade" note="Evaluated in order, first match wins, projects in reference order" defs={['owner', 'pipeline']} definitions={definitions}>
        <ol className="policy" id="cascade-steps">
          {cascade.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ol>
        <p>
          Which channel each vertical sells through:{' '}
          {data.verticals.map((v, i) => (
            <span key={v.slug}>
              {i > 0 && '; '}
              {v.name} through {v.channel === 'both' ? 'both' : v.channel}
            </span>
          ))}
          .
        </p>
        <p>
          Result: {count(data.kpis.owned)} projects owned ({pct((data.kpis.owned / data.kpis.projects) * 100)}), {count(data.kpis.unowned)} with no owner. Books run from {count(Math.min(...data.engineerSummary.map((e) => e.owned)))} to {count(Math.max(...data.engineerSummary.map((e) => e.owned)))} projects.
        </p>
      </Section>

      <Section id="buckets" title="The activity buckets" note="Exactly one per project and vertical pair, chosen by priority" defs={['bucket', 'open', 'orders']} definitions={definitions}>
        <ol className="policy" id="bucket-list">
          {bucketRule.slice(1, 1 + BUCKETS.length).map((b, i) => (
            <li key={i}>
              {b.replace(/^\d+\.\s*/, '')}: {count(data.funnel[i]!)} pairs
            </li>
          ))}
        </ol>
        <p>{bucketRule[0]}</p>
        <p>{bucketRule[bucketRule.length - 1]}</p>
      </Section>

      <Section id="precision" title="Precision policy">
        <ul className="policy">
          {precisionPolicy.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      </Section>

      <Section id="assumptions" title="Synthetic assumptions" note="What the generator chose, stated so nothing is mistaken for a survey">
        <ul className="policy">
          {assumptions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
        <div className="scroll-x">
          <table className="mis compact" style={{ maxWidth: 720 }} id="dist-table">
            <thead>
              <tr>
                <th scope="col" className="left">
                  Distribution
                </th>
                <th scope="col" className="left">
                  Value
                </th>
                <th scope="col">Projects</th>
                <th scope="col">Share</th>
              </tr>
            </thead>
            <tbody>
              {[...data.distributions.sectors.map((d) => ['Sector', d.sector, d.count] as const), ...data.distributions.stages.map((d) => ['Stage', d.stage, d.count] as const), ...data.distributions.cities.map((d) => ['City', d.city, d.count] as const)].map(([k, v, n], i) => (
                <motion.tr key={`${k}-${v}`} className="hov" {...rowReveal(i)}>
                  <td className="left muted">{k}</td>
                  <td className="left">{v}</td>
                  <td className="num">{count(n)}</td>
                  <td className="num">{pct((n / data.kpis.projects) * 100)}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="reconciliation" title="Reconciliation" note="scripts/reconcile.ts re-reads the published JSON files and asserts that every independently shown figure ties to every other, and that every derived figure follows its stated rule. Failures are listed first.">
        {rec.error && <p className="bad">The reconciliation file could not be loaded: {rec.error}</p>}
        {rec.data && (
          <>
            <p id="rec-summary">
              <span className={cx('status', rec.data.failed === 0 ? 'pass' : 'fail')}>{rec.data.failed === 0 ? 'All pass' : `${rec.data.failed} failed`}</span> {count(rec.data.passed)} of {count(rec.data.assertions.length)} assertions pass.
            </p>
            {failed.length > 0 && (
              <div className="scroll-x">
                <table className="mis compact" id="rec-failed-table">
                  <thead>
                    <tr>
                      <th scope="col" className="left">
                        Failed assertion
                      </th>
                      <th scope="col">Left</th>
                      <th scope="col">Right</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failed.map((a) => (
                      <tr key={a.id} className="hov">
                        <td className="left remark ink">{a.statement}</td>
                        <td className="num bad">{fmt(a.left)}</td>
                        <td className="num bad">{fmt(a.right)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="scroll-x">
              <table className="mis compact" id="rec-categories" style={{ maxWidth: 720 }}>
                <thead>
                  <tr>
                    <th scope="col" className="left">
                      Category
                    </th>
                    <th scope="col">Checked</th>
                    <th scope="col">Passed</th>
                    <th scope="col" className="left">
                      Every assertion
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rec.data.categories.map((c, i) => (
                    <motion.tr key={c.name} className="hov" {...rowReveal(i)}>
                      <th scope="row" className="left">
                        {c.name}
                      </th>
                      <td className="num">{count(c.checked)}</td>
                      <td className={cx('num', c.passed < c.checked && 'bad')}>{count(c.passed)}</td>
                      <td className="left">
                        <button type="button" className="elink" aria-expanded={openCat === c.name} onClick={() => setOpenCat(openCat === c.name ? null : c.name)}>
                          {openCat === c.name ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {openCat && (
              <div className="scroll-x" id="rec-open">
                <table className="mis compact" style={{ maxWidth: 1100 }}>
                  <thead>
                    <tr>
                      <th scope="col">Result</th>
                      <th scope="col" className="left">
                        Statement
                      </th>
                      <th scope="col">Left</th>
                      <th scope="col">Right</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.data.assertions
                      .filter((a) => a.category === openCat)
                      .map((a) => (
                        <tr key={a.id} className="hov">
                          <td>
                            <span className={cx('status', a.pass ? 'pass' : 'fail')}>{a.pass ? 'pass' : 'fail'}</span>
                          </td>
                          <td className="left remark ink">{a.statement}</td>
                          <td className="num">{fmt(a.left)}</td>
                          <td className="num">{fmt(a.right)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Section>

      <Section id="definitions" title="Definitions">
        <dl className="basis-list">
          {Object.values(definitions).map((d) => (
            <div key={d.key}>
              <dt>{d.term}</dt>
              <dd>{d.text}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <Footer meta={meta} />
    </div>
  );
}

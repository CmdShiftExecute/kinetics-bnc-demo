import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { aedm, count, cx } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise } from '../components/Reveal';
import { Heatmap } from '../components/Heatmap';
import type { CellInfo } from '../components/Heatmap';
import { Section } from '../components/Section';

/** The relevance matrix as a heatmap with a side panel that explains the scale and reads the cell under the pointer. */
export default function RelevancePage() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rise = useRise();
  const [rolled, setRolled] = useState(false);
  const [colour, setColour] = useState<'grade' | 'value'>('grade');
  const [cell, setCell] = useState<CellInfo | null>(null);
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading rows={14} />;
  const { meta, gradeScore } = data;
  const graded = data.matrix.reduce((a, r) => a + r.cells.filter(Boolean).length, 0);
  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Relevance matrix</h1>
          <p className="page-sub">How much each vertical has to sell into each kind of project</p>
        </div>
        <p className="page-basis">
          {count(data.matrix.length)} rows by {data.verticals.length} verticals, {count(graded)} graded cells
          <br />
          Cell: grade and the projects graded, click to open them
        </p>
      </motion.div>

      <div className="side heat-side">
        <Section id="matrix" title="The matrix" note="Rows: project types under industry under sector. Columns: the ten verticals. Click a cell to open the Projects page filtered to it.">
          <div className="seg-row" role="group" aria-label="Matrix view">
            <button type="button" id="roll-toggle" className={cx('segb small press', !rolled && 'on')} aria-pressed={!rolled} onClick={() => setRolled(false)}>
              Sector, industry, type
            </button>
            <button type="button" id="roll-sector" className={cx('segb small press', rolled && 'on')} aria-pressed={rolled} onClick={() => setRolled(true)}>
              Rolled up to sector
            </button>
            <span className="seg-gap" aria-hidden="true" />
            <button type="button" id="colour-grade" className={cx('segb small press', colour === 'grade' && 'on')} aria-pressed={colour === 'grade'} onClick={() => setColour('grade')}>
              Tint by grade
            </button>
            <button type="button" id="colour-value" className={cx('segb small press', colour === 'value' && 'on')} aria-pressed={colour === 'value'} onClick={() => setColour('value')}>
              Tint by project value
            </button>
          </div>
          <Heatmap rollup={data} rolled={rolled} colour={colour} onCell={setCell} />
        </Section>
        <aside className="pl-rail heat-panel" aria-label="Grade scale and the cell under the pointer">
          <h3 className="label">The grade scale</h3>
          <dl className="scale-list" id="grade-scale">
            <div>
              <dt>
                <span className="swatch hg-high" aria-hidden="true" /> High
              </dt>
              <dd>{gradeScore.High.toFixed(1)}. The vertical is core to this kind of project.</dd>
            </div>
            <div>
              <dt>
                <span className="swatch hg-med" aria-hidden="true" /> Medium
              </dt>
              <dd>{gradeScore.Medium.toFixed(1)}. Usually present, not always Halvard's to win.</dd>
            </div>
            <div>
              <dt>
                <span className="swatch hg-low" aria-hidden="true" /> Low
              </dt>
              <dd>{gradeScore.Low.toFixed(1)}. Occasional, below the scope floor of {data.scopeFloor.toFixed(1)}.</dd>
            </div>
            <div>
              <dt>
                <span className="swatch hg-none" aria-hidden="true" /> None
              </dt>
              <dd>No relevance recorded.</dd>
            </div>
          </dl>
          {colour === 'value' && (
            <>
              <h3 className="label">Value tint</h3>
              <p>
                Five steps of one slate scale, lightest to darkest by the graded projects' value on that vertical.{' '}
                <span className="swatch hv-1" aria-hidden="true" />
                <span className="swatch hv-2" aria-hidden="true" />
                <span className="swatch hv-3" aria-hidden="true" />
                <span className="swatch hv-4" aria-hidden="true" />
                <span className="swatch hv-5" aria-hidden="true" />
              </p>
            </>
          )}
          <h3 className="label">Under the pointer</h3>
          <div id="cell-read" className={cx('cell-read', cell && 'on')} aria-live="polite">
            {cell ? (
              <>
                <p className="cell-title">
                  <strong>{cell.label}</strong>
                  <br />
                  {cell.vertical}
                </p>
                <dl className="vals">
                  <div>
                    <dt>Grade</dt>
                    <dd>{cell.grade ?? 'None'}</dd>
                  </div>
                  <div>
                    <dt>Projects graded</dt>
                    <dd>
                      {count(cell.graded)} of {count(cell.projects)}
                      {cell.grade && cell.graded !== cell.byGrade[cell.grade] ? ` (High ${count(cell.byGrade.High)}, Medium ${count(cell.byGrade.Medium)}, Low ${count(cell.byGrade.Low)})` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Value</dt>
                    <dd>AED {aedm(cell.value)} m</dd>
                  </div>
                </dl>
                <Link to={cell.to} className="drill-link press">
                  Open these projects
                </Link>
              </>
            ) : (
              <p className="muted">Point at a cell, or tab to one, to read its grade, project count and value. Click it to open those projects.</p>
            )}
          </div>
          <h3 className="label">How a project gets its scores</h3>
          <p>Every project carries one score per vertical, looked up by its project type on this matrix when it enters the register. A few rows carry a hand-adjusted score between the grades; those show to one decimal on the project page.</p>
        </aside>
      </div>
      <Footer meta={meta} />
    </div>
  );
}

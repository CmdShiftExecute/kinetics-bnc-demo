import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { aedm, count, cx, pct } from '../lib/format';
import { HIGH_FLOOR } from '../lib/filters';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useRise } from '../components/Reveal';
import { Heatmap } from '../components/Heatmap';
import { Section } from '../components/Section';
import { Strip } from '../components/Strip';
import { HBars } from '../components/HBars';
import { ChartSwitch } from '../components/ChartSwitch';

/** The relevance matrix: the headline figures, how far each vertical reaches, then the heatmap full width with the grade scale beneath it. */
export default function RelevancePage() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rise = useRise();
  const [rolled, setRolled] = useState(false);
  const [colour, setColour] = useState<'grade' | 'value'>('grade');
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading rows={14} />;
  const { meta, gradeScore, matrixSummary: ms, definitions } = data;
  const reachRows = (mode: 'projects' | 'rows') =>
    [...ms.reach]
      .sort((a, b) => (mode === 'projects' ? b.projectsHigh - a.projectsHigh : b.rowsHigh - a.rowsHigh) || a.name.localeCompare(b.name))
      .map((r) => ({
        key: r.slug,
        name: r.name,
        segments:
          mode === 'projects'
            ? [
                { key: 'h', label: 'High', value: r.projectsHigh, cls: 'spot' as const },
                { key: 'm', label: 'Medium', value: r.projectsMedium, cls: 'spot2' as const },
                { key: 'l', label: 'Low', value: r.projectsLow, cls: 'ink3' as const },
              ]
            : [
                { key: 'h', label: 'High', value: r.rowsHigh, cls: 'spot' as const },
                { key: 'm', label: 'Medium', value: r.rowsMedium, cls: 'spot2' as const },
                { key: 'l', label: 'Low', value: r.rowsLow, cls: 'ink3' as const },
              ],
        end: mode === 'projects' ? count(r.projectsHigh + r.projectsMedium + r.projectsLow) : count(r.rowsHigh + r.rowsMedium + r.rowsLow),
        endNote: mode === 'projects' ? `AED ${aedm(r.valueHigh)} m at High` : `of ${count(data.matrix.length)} rows`,
      }));
  const legend = [
    { cls: 'spot' as const, label: 'High' },
    { cls: 'spot2' as const, label: 'Medium' },
    { cls: 'ink3' as const, label: 'Low' },
  ];
  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Relevance matrix</h1>
          <p className="page-sub">How much each vertical has to sell into each kind of project</p>
        </div>
        <p className="page-basis">
          {count(data.matrix.length)} rows by {data.verticals.length} verticals, {count(ms.cellsGraded)} graded cells
          <br />
          Cell: grade and the projects graded, click to open them
        </p>
      </motion.div>

      <Strip
        id="matrix-kpis"
        label="Matrix headline figures"
        cols={6}
        items={[
          { label: 'Cells graded', value: ms.cellsGraded, f: count, sub: `of ${count(ms.cellsTotal)}, ${pct((ms.cellsGraded / ms.cellsTotal) * 100)} of the matrix`, id: 'mk-cells' },
          { label: 'Projects reading High', value: ms.projectsOverallHigh, f: count, sub: `${pct((ms.projectsOverallHigh / data.kpis.projects) * 100)} of the register, AED ${aedm(ms.valueOverallHigh)} m`, to: `/projects?omin=${HIGH_FLOOR}&sort=overall`, id: 'mk-high' },
          { label: 'Widest vertical', value: ms.widestVertical.rowsHigh, f: (n) => `${count(n)} High rows`, text: true, sub: ms.widestVertical.name, to: `/projects?v=${ms.widestVertical.slug}&floor=6.5`, id: 'mk-widest' },
          { label: 'Most relevant type', value: ms.topType.cellsHigh, f: (n) => `${count(n)} of ${data.verticals.length} High`, text: true, sub: `${ms.topType.type}, ${count(ms.topType.projects)} projects`, to: `/projects?type=${encodeURIComponent(ms.topType.type)}`, id: 'mk-type' },
          { label: 'Hand-adjusted scores', value: ms.projectsAdjusted, f: count, sub: `projects, ${pct((ms.projectsAdjusted / data.kpis.projects) * 100)} of the register`, id: 'mk-adjusted' },
          { label: 'Below the scope floor', value: ms.projectsBelowFloor, f: count, sub: ms.projectsBelowFloor === 0 ? `every project scores ${data.scopeFloor.toFixed(1)} or more somewhere` : `projects no vertical can own`, id: 'mk-floor' },
        ]}
      />

      <Section id="reach" title="How far each vertical reaches" note="Projects graded High, Medium and Low on each vertical, widest reach first" defs={['relevance']} definitions={definitions}>
        <ChartSwitch
          id="reach"
          views={[
            { key: 'projects', label: 'Projects', render: () => <HBars id="reach-chart" rows={reachRows('projects')} format={count} unit="projects" legend={legend} ariaLabel={`Projects by grade on each vertical. ${ms.reach.map((r) => `${r.name}: ${count(r.projectsHigh)} High, ${count(r.projectsMedium)} Medium, ${count(r.projectsLow)} Low`).join('. ')}.`} /> },
            { key: 'rows', label: 'Matrix rows', render: () => <HBars id="reach-chart" rows={reachRows('rows')} format={count} unit="rows" legend={legend} ariaLabel={`Matrix rows by grade on each vertical. ${ms.reach.map((r) => `${r.name}: ${r.rowsHigh} High, ${r.rowsMedium} Medium, ${r.rowsLow} Low`).join('. ')}.`} /> },
            { key: 'share', label: 'Grade mix', render: () => <HBars id="reach-chart" rows={reachRows('projects')} format={count} unit="projects" legend={legend} mode="share" ariaLabel="Share of graded projects by grade on each vertical." /> },
          ]}
        />
      </Section>

      <Section id="matrix" title="The matrix" note="Rows: project types under industry under sector. Columns: the ten verticals. Point at a cell to read it; click it to open the Projects page filtered to it.">
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
        <Heatmap rollup={data} rolled={rolled} colour={colour} />
      </Section>

      <Section id="grade-scale" title="The grade scale" note="What each cell means, and the numbers behind the grades">
        <dl className="scale-list wide" id="grade-scale">
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
          <p className="muted" id="value-tint-note">
            Value tint: five steps of one slate scale by the graded projects' value on that vertical, on a square-root scale of each cell's share of the largest cell at its own level (a sector row against the largest sector cell, an industry row against the largest industry cell, a type row against the largest type cell): 4 percent of the largest reads the first step, 16 percent the second, 36 the third, 64 the fourth, the largest the fifth. The scale is the same whatever is expanded. <span className="swatch hv-1" aria-hidden="true" />
            <span className="swatch hv-2" aria-hidden="true" />
            <span className="swatch hv-3" aria-hidden="true" />
            <span className="swatch hv-4" aria-hidden="true" />
            <span className="swatch hv-5" aria-hidden="true" />
          </p>
        )}
      </Section>

      <Section id="how-scores" title="How a project gets its scores" defs={['relevance', 'overall']} definitions={definitions} link={{ to: '/data-basis#grades', label: 'Data basis' }}>
        <p>
          Every project carries one score per vertical, looked up by its project type on this matrix when it enters the register, and it never changes with stage or location. Grades convert to {gradeScore.High.toFixed(1)}, {gradeScore.Medium.toFixed(1)} and {gradeScore.Low.toFixed(1)}. {count(ms.projectsAdjusted)} projects carry a hand-adjusted score between the grades; those show to one decimal, marked with an asterisk, on the project page. A project's overall relevance is the highest of its ten scores, so {count(ms.projectsOverallHigh)} projects read High overall.{' '}
          <Link to="/data-basis#cascade" className="elink">
            The ownership cascade
          </Link>{' '}
          then decides which vertical, if any, owns each one.
        </p>
      </Section>
      <Footer meta={meta} />
    </div>
  );
}

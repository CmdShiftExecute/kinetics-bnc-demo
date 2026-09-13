import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { aedm, count, pct } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useReveal, useRise } from '../components/Reveal';
import { MixBar, bandCounts } from '../components/MixBar';
import { Strip } from '../components/Strip';
import { Section } from '../components/Section';
import { HBars } from '../components/HBars';
import { ChartSwitch } from '../components/ChartSwitch';

/** The engineers: the headline figures, every book on one chart grouped by vertical, then one block per engineer under its vertical. */
export default function EngineersPage() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rise = useRise();
  const reveal = useReveal();
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading rows={14} />;
  const { meta, definitions } = data;
  const books = data.engineerSummary.map((e) => e.owned);
  const largest = [...data.engineerSummary].sort((a, b) => b.owned - a.owned)[0]!;
  const richest = [...data.engineerSummary].sort((a, b) => b.ownedValue - a.ownedValue)[0]!;
  const vName = (slug: string) => data.verticals.find((v) => v.slug === slug)?.name ?? slug;
  const ordered = data.verticals.flatMap((v) => data.engineerSummary.filter((e) => e.vertical === v.slug).sort((a, b) => b.ownedValue - a.ownedValue));
  const rows = (mode: 'value' | 'count' | 'mix') =>
    ordered.map((e) => {
      const bands = bandCounts(e.funnel);
      return {
        key: e.slug,
        name: e.name,
        group: vName(e.vertical),
        segments:
          mode === 'value'
            ? [{ key: 'v', label: 'Pipeline value', value: e.ownedValue, cls: 'spot' as const }]
            : mode === 'count'
              ? [{ key: 'n', label: 'Projects owned', value: e.owned, cls: 'spot' as const }]
              : [
                  { key: 'won', label: 'Orders', value: bands[0]!, cls: 'ink' as const },
                  { key: 'active', label: 'Active', value: bands[1]!, cls: 'spot' as const },
                  { key: 'quiet', label: 'Waiting or quiet', value: bands[2]!, cls: 'ink3' as const },
                  { key: 'closed', label: 'Closed', value: bands[3]!, cls: 'hz' as const },
                ],
        end: mode === 'value' ? aedm(e.ownedValue) : count(e.owned),
        endNote: mode === 'value' ? `${count(e.owned)} projects` : mode === 'count' ? `AED ${aedm(e.ownedValue)} m` : `${count(bands[1]!)} active`,
      };
    });
  return (
    <div className="wrap">
      <Masthead meta={meta} />
      <motion.div className="page-head" {...rise()}>
        <div>
          <h1 className="display page-title">Engineers</h1>
          <p className="page-sub">Who owns which projects, by vertical, and how far each book has moved</p>
        </div>
        <p className="page-basis">
          {data.engineers.length} engineers on {data.verticals.length} verticals
          <br />
          Books from {count(Math.min(...books))} to {count(Math.max(...books))} projects
        </p>
      </motion.div>
      <Strip
        id="eng-kpis"
        cols={6}
        label="Engineer headline figures"
        items={[
          { label: 'Projects owned', value: data.kpis.owned, f: count, sub: `${pct((data.kpis.owned / data.kpis.projects) * 100)} of ${count(data.kpis.projects)} in the register`, id: 'ek-owned' },
          { label: 'Pipeline value owned', value: data.kpis.ownedValue, sub: 'AED million across every book', id: 'ek-value' },
          { label: 'Largest book', value: largest.owned, f: count, sub: `${largest.name}, ${vName(largest.vertical)}`, to: `/engineers/${largest.slug}`, id: 'ek-largest' },
          { label: 'Richest book', value: richest.ownedValue, sub: `AED m, ${richest.name}, ${vName(richest.vertical)}`, to: `/engineers/${richest.slug}`, id: 'ek-richest' },
          { label: 'Average book', value: Math.round(data.kpis.owned / data.engineers.length), f: count, sub: `projects per engineer, AED ${aedm(Math.round((data.kpis.ownedValue / data.engineers.length) * 10) / 10)} m`, id: 'ek-average' },
          { label: 'Enquiries and quotes', value: data.engineerSummary.reduce((a, e) => a + e.funnel[1]! + e.funnel[2]!, 0), f: count, sub: `live on owned projects, ${count(data.engineerSummary.reduce((a, e) => a + e.funnel[0]!, 0))} orders`, id: 'ek-open' },
        ]}
      />

      <Section id="books" title="Every book on one page" note="Pipeline value owned by each engineer, grouped under their vertical, largest first within each" defs={['owner', 'pipeline']} definitions={definitions}>
        <ChartSwitch
          id="books"
          views={[
            { key: 'value', label: 'Value, AED m', render: () => <HBars id="books-chart" rows={rows('value')} format={aedm} unit="AED m" ariaLabel={`Pipeline value by engineer. ${ordered.map((e) => `${e.name}: AED ${aedm(e.ownedValue)} million`).join('. ')}.`} /> },
            { key: 'count', label: 'Projects', render: () => <HBars id="books-chart" rows={rows('count')} format={count} unit="projects" ariaLabel={`Projects owned by engineer. ${ordered.map((e) => `${e.name}: ${count(e.owned)}`).join('. ')}.`} /> },
            { key: 'mix', label: 'Activity mix', render: () => <HBars id="books-chart" rows={rows('mix')} format={count} unit="projects" mode="share" legend={[{ cls: 'ink', label: 'Orders' }, { cls: 'spot', label: 'Active' }, { cls: 'ink3', label: 'Waiting or quiet' }, { cls: 'hz', label: 'Closed' }]} ariaLabel="Activity mix of each engineer's book." /> },
          ]}
        />
      </Section>

      {data.verticalSummary.map((v) => {
        const engs = data.engineerSummary.filter((e) => e.vertical === v.slug).sort((a, b) => b.ownedValue - a.ownedValue);
        return (
          <motion.section key={v.slug} className="sec" id={`v-${v.slug}`} aria-labelledby={`v-${v.slug}-title`} {...reveal()}>
            <header className="sec-head">
              <div>
                <h2 className="display sec-title" id={`v-${v.slug}-title`}>
                  {v.name}
                </h2>
                <p className="sec-note">
                  Sells through {v.channel === 'both' ? 'consultants and contractors' : v.channel}. {count(v.owned)} projects owned, AED {aedm(v.ownedValue)} m, {v.engineers} engineer{v.engineers === 1 ? '' : 's'}.
                </p>
              </div>
              <Link to={`/projects?v=${v.slug}&floor=4`} className="sec-link press">
                Projects scoring 4.0 or more {'>>>'}
              </Link>
            </header>
            <div className="ledger" style={{ '--cols': Math.min(3, engs.length) } as React.CSSProperties}>
              {engs.map((e) => (
                <article key={e.slug} className="ledger-cell hovc" data-slug={e.slug} data-owned={e.owned}>
                  <h3 className="ledger-name">
                    <Link to={`/engineers/${e.slug}`} className="elink">
                      {e.name}
                    </Link>
                  </h3>
                  <dl className="ledger-figs">
                    <div>
                      <dt>Owned</dt>
                      <dd className="num">{count(e.owned)}</dd>
                    </div>
                    <div>
                      <dt>AED m</dt>
                      <dd className="num">{aedm(e.ownedValue)}</dd>
                    </div>
                    <div>
                      <dt>Relationships</dt>
                      <dd className="num">
                        {count(e.consultants)} c / {count(e.contractors)} k
                      </dd>
                    </div>
                  </dl>
                  <MixBar funnel={e.funnel} id={`mix-${e.slug}`} width={260} />
                  <ol className="ledger-top">
                    {e.top.slice(0, 3).map((t) => (
                      <li key={t.ref}>
                        <Link to={`/p/${t.ref}`} className="elink">
                          {t.name}
                        </Link>
                        <span className="num muted">{aedm(t.value)}</span>
                      </li>
                    ))}
                  </ol>
                  <Link to={`/engineers/${e.slug}`} className="drill-link press">
                    Open book
                  </Link>
                </article>
              ))}
            </div>
          </motion.section>
        );
      })}
      <Footer meta={meta} />
    </div>
  );
}

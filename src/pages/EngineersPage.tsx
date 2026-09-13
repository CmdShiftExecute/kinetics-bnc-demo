import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Rollup } from '../../data/schema';
import { useJson } from '../lib/data';
import { validateRollup } from '../lib/validate';
import { aedm, count } from '../lib/format';
import { Masthead } from '../components/Masthead';
import { Footer } from '../components/Footer';
import { PageError, PageLoading } from '../components/PageState';
import { useReveal, useRise } from '../components/Reveal';
import { MixBar } from '../components/MixBar';
import { Strip } from '../components/Strip';

/** One block per engineer, grouped by vertical, ruled like a printed ledger rather than floating cards. */
export default function EngineersPage() {
  const { data, error } = useJson<Rollup>('rollup.json', validateRollup);
  const rise = useRise();
  const reveal = useReveal();
  if (error) return <PageError message={error} />;
  if (!data) return <PageLoading rows={14} />;
  const { meta } = data;
  const books = data.engineerSummary.map((e) => e.owned);
  const largest = [...data.engineerSummary].sort((a, b) => b.owned - a.owned)[0]!;
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
        cols={4}
        label="Engineer headline figures"
        items={[
          { label: 'Projects owned', value: data.kpis.owned, f: count, sub: `of ${count(data.kpis.projects)} in the register` },
          { label: 'Pipeline value owned', value: data.kpis.ownedValue, sub: 'AED million' },
          { label: 'Largest book', value: largest.owned, f: count, sub: `${largest.name}, ${data.verticals.find((v) => v.slug === largest.vertical)?.name}` },
          { label: 'Average book', value: Math.round(data.kpis.owned / data.engineers.length), f: count, sub: 'projects per engineer' },
        ]}
      />
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

import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Definition, Source } from '../../data/schema';
import { useReveal } from './Reveal';

interface Props {
  id: string;
  title: string;
  /** Period and unit, e.g. "AED thousands, January to August 2026". */
  note?: string;
  intro?: ReactNode;
  link?: { to: string; label: string };
  source?: Source;
  asOf?: string;
  /** Definition keys shown under the section; the reader opens them, no hover needed. */
  defs?: string[];
  definitions?: Record<string, Definition>;
  /** Render as a compact overview quadrant. */
  compact?: boolean;
  children: ReactNode;
}

/** A section of the pack: a heavy rule, the report name, its period and unit, the content, and its definitions and source. */
export function Section({ id, title, note, intro, link, source, asOf, defs, definitions, compact, children }: Props) {
  const reveal = useReveal();
  const shown = (defs ?? []).map((k) => definitions?.[k]).filter((d): d is Definition => Boolean(d));
  return (
    <motion.section className={compact ? 'sec compact' : 'sec'} id={id} aria-labelledby={`${id}-title`} {...reveal()}>
      <header className="sec-head">
        <div>
          <h2 className="display sec-title" id={`${id}-title`}>
            {title}
          </h2>
          {note && <p className="sec-note">{note}</p>}
        </div>
        {link && (
          <Link to={link.to} className="sec-link press">
            {link.label} {'>>>'}
          </Link>
        )}
      </header>
      {intro && <div className="sec-intro">{intro}</div>}
      {children}
      {(shown.length > 0 || source) && (
        <details className="defs">
          <summary>Definitions and source</summary>
          <dl>
            {shown.map((d) => (
              <div key={d.key}>
                <dt>{d.term}</dt>
                <dd>{d.text}</dd>
              </div>
            ))}
            {source && (
              <div>
                <dt>Source</dt>
                <dd>
                  {source.label}
                  {asOf ? `, data as of ${asOf}` : ''}. Synthetic demonstration data.
                </dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </motion.section>
  );
}

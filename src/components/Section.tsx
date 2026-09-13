import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import type { Definition } from '../../data/schema';
import { useReveal } from './Reveal';

interface Props {
  id: string;
  title: string;
  /** Unit and basis, e.g. "AED million, register as of 12 Sep 2026". */
  note?: string;
  intro?: ReactNode;
  link?: { to: string; label: string };
  /** Definition keys shown under the section; the reader opens them, no hover needed. */
  defs?: string[];
  definitions?: Record<string, Definition>;
  compact?: boolean;
  children: ReactNode;
}

/** A section: a heavy rule, the block name, its basis, the content, and its definitions. */
export function Section({ id, title, note, intro, link, defs, definitions, compact, children }: Props) {
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
      {shown.length > 0 && (
        <details className="defs">
          <summary>Definitions</summary>
          <dl>
            {shown.map((d) => (
              <div key={d.key}>
                <dt>{d.term}</dt>
                <dd>{d.text}</dd>
              </div>
            ))}
            <div>
              <dt>Source</dt>
              <dd>The market register, synthetic demonstration data generated from one seed. Every figure is reconciled on the Data basis page.</dd>
            </div>
          </dl>
        </details>
      )}
    </motion.section>
  );
}

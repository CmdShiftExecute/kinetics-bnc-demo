import { motion } from 'motion/react';
import { Link } from 'react-router';
import { aedm, cx } from '../lib/format';
import { useRise } from './Reveal';

export interface StripItem {
  label: string;
  /** The figure, unformatted; the component applies the formatter. */
  value: number;
  /** Formatter, defaults to AED million to one decimal. */
  f?: (n: number) => string;
  sub?: string;
  /** Where the context line leads. */
  to?: string;
  bad?: boolean;
  /** A worded figure (a name, a stage): set smaller and allowed to wrap, so it never widens the page. */
  text?: boolean;
  id?: string;
}

/** A row of headline figures, each with its label above and its context below. The figures do not animate; the strip rises in. */
export function Strip({ items, cols, id, label }: { items: StripItem[]; cols?: number; id?: string; label?: string }) {
  const rise = useRise();
  return (
    <motion.dl className="strip" id={id} aria-label={label} style={cols ? ({ '--cols': cols } as React.CSSProperties) : undefined} {...rise(0.1)}>
      {items.map((it) => (
        <div key={it.label} id={it.id}>
          <dt>{it.label}</dt>
          <dd className={cx('big', it.text && 'text', it.bad && 'bad')}>{(it.f ?? aedm)(it.value)}</dd>
          {it.sub && (
            <dd className="sub">
              {it.to ? (
                <Link to={it.to} className="vlink">
                  {it.sub}
                </Link>
              ) : (
                it.sub
              )}
            </dd>
          )}
        </div>
      ))}
    </motion.dl>
  );
}

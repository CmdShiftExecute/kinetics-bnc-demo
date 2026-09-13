import { motion } from 'motion/react';
import { aed, cx } from '../lib/format';
import { useRise } from './Reveal';

export interface StripItem {
  label: string;
  /** The figure, unformatted; the component applies the formatter. */
  value: number;
  /** Formatter, defaults to whole AED. */
  f?: (n: number) => string;
  sub?: string;
  bad?: boolean;
}


/** A row of headline figures, each with its label above and its comparator below.
 *  The figures do NOT animate. A count-up was removed on 12 Sep 2026: mid-tween the
 *  strip displayed values that did not cross-foot (revenue minus budget disagreeing
 *  with the variance beside it) for about a second after every mount, which on a
 *  finance surface is a worse failure than a slow page. The strip still rises in. */
export function Strip({ items, cols }: { items: StripItem[]; cols?: number }) {
  const rise = useRise();
  return (
    <motion.dl className="strip" style={cols ? ({ '--cols': cols } as React.CSSProperties) : undefined} {...rise(0.1)}>
      {items.map((it) => (
        <div key={it.label}>
          <dt>{it.label}</dt>
          <dd className={cx('big', it.bad && 'bad')}>{(it.f ?? aed)(it.value)}</dd>
          {it.sub && <dd className="sub">{it.sub}</dd>}
        </div>
      ))}
    </motion.dl>
  );
}

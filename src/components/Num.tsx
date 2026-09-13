import { aedm, cx } from '../lib/format';

interface Props {
  v: number;
  /** Formatter, defaults to AED million to one decimal. */
  f?: (n: number) => string;
  /** Render in hazard red: a breach or a failed check. Never decoration. */
  bad?: boolean;
  className?: string;
}

/** A typeset figure in a table cell. */
export function Num({ v, f = aedm, bad, className }: Props) {
  return <td className={cx('num', bad && 'bad', className)}>{f(v)}</td>;
}

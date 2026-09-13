import { aed, cx } from '../lib/format';

interface Props {
  v: number;
  /** Formatter, defaults to whole AED. */
  f?: (n: number) => string;
  /** Render in hazard red: negative variance, past due, an alert. Never decoration. */
  bad?: boolean;
  className?: string;
  /** Space-separated header ids for assistive technology on grouped tables. */
  headers?: string;
}

/** A typeset figure in a table cell. */
export function Num({ v, f = aed, bad, className, headers }: Props) {
  return (
    <td className={cx('num', bad && 'bad', className)} headers={headers}>
      {f(v)}
    </td>
  );
}

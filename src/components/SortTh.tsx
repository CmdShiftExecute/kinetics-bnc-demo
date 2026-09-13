import type { SortDir } from '../lib/sort';

interface Props {
  label: string;
  /** True when this column drives the current sort. */
  active: boolean;
  dir: SortDir;
  /** Direction used when the column is first selected. */
  natural: SortDir;
  onSort: (natural: SortDir) => void;
  className?: string;
  title?: string;
  id?: string;
}

/** A sortable column header: a real button, aria-sort on the th, an arrow that only shows the active direction. */
export function SortTh({ label, active, dir, natural, onSort, className, title, id }: Props) {
  return (
    <th scope="col" id={id} className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} title={title}>
      <button type="button" className="sort" onClick={() => onSort(natural)} aria-label={`Sort by ${label}`}>
        {label}
        <span className="sort-mark" aria-hidden="true">
          {active ? (dir === 'asc' ? '▴' : '▾') : '▴▾'}
        </span>
      </button>
    </th>
  );
}

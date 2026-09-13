import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

/**
 * Sorts rows by one numeric or text key. Returns the sorted copy, the current
 * state and a toggle: clicking the active column flips direction, clicking
 * another column sorts by it in its natural direction (numbers descending,
 * text ascending).
 */
export function useSort<T, K extends string>(rows: T[], get: (row: T, key: K) => number | string, initial: SortState<K>) {
  const [state, setState] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const x = get(a, state.key);
      const y = get(b, state.key);
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return state.dir === 'asc' ? c : -c;
    });
    return copy;
  }, [rows, get, state]);
  const toggle = (key: K, naturalDir: SortDir) => setState((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: naturalDir }));
  return { sorted, state, toggle };
}

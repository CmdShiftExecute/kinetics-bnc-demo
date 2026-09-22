import { useMemo, useState } from 'react';
import type { Party, PartyKind, PartyRole, Vertical } from '../../data/schema';
import { aedLabel, count, cx } from '../lib/format';

const ROLE_LABEL: Record<PartyKind, Record<PartyRole, string>> = {
  consultant: { lead: 'Lead / Design', mep: 'MEP', both: 'Lead and MEP' },
  contractor: { lead: 'Main / EPC', mep: 'MEP', both: 'Main and MEP' },
};
export const roleLabel = (kind: PartyKind, role: PartyRole) => ROLE_LABEL[kind][role];

/** The relationship filter: any firm, firms the group holds a relationship with, or firms it has none with yet. */
export type RelFilter = 'any' | 'held' | 'none';

/**
 * The measure a firm is ranked and read on: its whole book, or its book on one vertical
 * (projects graded Medium or High on that vertical, and their value). One function for
 * the picker, the top-firms chart and the card, so the three never disagree.
 */
export function measureOf(p: Party, vi: number | null): { n: number; value: number } {
  return vi === null ? { n: p.projectCount, value: p.projectValue } : { n: p.verticalCounts[vi] ?? 0, value: p.verticalValues[vi] ?? 0 };
}

interface Props {
  kind: PartyKind;
  role: PartyRole | 'any';
  rel: RelFilter;
  /** The vertical the list is ranked on, or null for the whole book. */
  vertical: string | null;
  verticals: Vertical[];
  list: Party[];
  selected: number | null;
  onKind: (k: PartyKind) => void;
  onRole: (r: PartyRole | 'any') => void;
  onRel: (r: RelFilter) => void;
  onVertical: (slug: string | null) => void;
  onPick: (id: number) => void;
}

/**
 * The selector across the two party lists: consultant or contractor, a role filter, a
 * relationship filter, the vertical to rank on, a name search, and the list sorted by
 * the chosen measure. Picking one shows its card.
 */
export function PartyPicker({ kind, role, rel, vertical, verticals, list, selected, onKind, onRole, onRel, onVertical, onPick }: Props) {
  const [q, setQ] = useState('');
  const vi = vertical ? verticals.findIndex((v) => v.slug === vertical) : -1;
  const vIdx = vi >= 0 ? vi : null;
  const vName = vIdx !== null ? verticals[vIdx]!.name : null;
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list
      .filter((p) => (role === 'any' || p.role === role || p.role === 'both') && (rel === 'any' || (rel === 'held') === (p.level !== null)) && (!t || p.name.toLowerCase().includes(t)) && (vIdx === null || (p.verticalCounts[vIdx] ?? 0) > 0))
      .map((p) => ({ p, m: measureOf(p, vIdx) }))
      .sort((a, b) => b.m.n - a.m.n || b.m.value - a.m.value || a.p.name.localeCompare(b.p.name));
  }, [list, role, rel, q, vIdx]);
  const roles: (PartyRole | 'any')[] = ['any', 'lead', 'mep'];
  const rels: RelFilter[] = ['any', 'held', 'none'];
  return (
    <div className="picker" id="picker">
      <div className="seg-row" role="group" aria-label="Party kind">
        {(['consultant', 'contractor'] as PartyKind[]).map((k) => (
          <button key={k} type="button" className={cx('segb press', kind === k && 'on')} aria-pressed={kind === k} data-kind={k} onClick={() => onKind(k)}>
            {k === 'consultant' ? 'Consultants' : 'Contractors'}
          </button>
        ))}
      </div>
      <div className="seg-row" role="group" aria-label="Role">
        {roles.map((r) => (
          <button key={r} type="button" className={cx('segb small press', role === r && 'on')} aria-pressed={role === r} data-role={r} onClick={() => onRole(r)}>
            {r === 'any' ? 'Any role' : r === 'lead' ? (kind === 'consultant' ? 'Lead / Design' : 'Main / EPC') : 'MEP'}
          </button>
        ))}
      </div>
      <div className="seg-row" role="group" aria-label="Relationship">
        {rels.map((r) => (
          <button key={r} type="button" className={cx('segb small press', rel === r && 'on')} aria-pressed={rel === r} data-rel={r} onClick={() => onRel(r)}>
            {r === 'any' ? 'Any relationship' : r === 'held' ? 'Relationship held' : 'No relationship yet'}
          </button>
        ))}
      </div>
      <label className="picker-vertical">
        <span className="label">Rank on vertical</span>
        <select className="pick" id="party-vertical" value={vertical ?? ''} aria-label="Rank firms on a vertical" onChange={(e) => onVertical(e.target.value || null)}>
          <option value="">Whole book</option>
          {verticals.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <input type="search" id="party-q" value={q} placeholder={`Search ${kind}s by name`} aria-label={`Search ${kind}s by name`} onChange={(e) => setQ(e.target.value)} />
      <p className="label" id="picker-count" data-count={rows.length}>
        {count(rows.length)} {kind}s{vName ? `, ranked by projects relevant to ${vName}` : ', largest book first'}
      </p>
      <ol className="plist" id="plist" aria-label={`${kind} list`}>
        {rows.map(({ p, m }) => (
          <li key={p.id}>
            <button type="button" className={cx('plist-b', selected === p.id && 'on')} aria-pressed={selected === p.id} data-id={p.id} data-n={m.n} onClick={() => onPick(p.id)}>
              <span className="plist-name">
                {p.name}
                {p.level === null && <span className="tag norel">No relationship</span>}
              </span>
              <span className="plist-meta">
                {roleLabel(kind, p.role)} · {count(m.n)} projects{vName ? ` on ${vName}` : ''} · {aedLabel(m.value)}
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="empty">
            <strong>No {kind} matches.</strong> Try a shorter name, another role, or another vertical.
          </li>
        )}
      </ol>
    </div>
  );
}

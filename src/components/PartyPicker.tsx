import { useMemo, useState } from 'react';
import type { Party, PartyKind, PartyRole } from '../../data/schema';
import { aedm, count, cx } from '../lib/format';

const ROLE_LABEL: Record<PartyKind, Record<PartyRole, string>> = {
  consultant: { lead: 'Lead / Design', mep: 'MEP', both: 'Lead and MEP' },
  contractor: { lead: 'Main / EPC', mep: 'MEP', both: 'Main and MEP' },
};
export const roleLabel = (kind: PartyKind, role: PartyRole) => ROLE_LABEL[kind][role];

interface Props {
  kind: PartyKind;
  role: PartyRole | 'any';
  list: Party[];
  selected: number | null;
  onKind: (k: PartyKind) => void;
  onRole: (r: PartyRole | 'any') => void;
  onPick: (id: number) => void;
}

/**
 * The selector across the two party lists: consultant or contractor, a role filter,
 * a name search, and the list sorted by project count. Picking one shows its card.
 */
export function PartyPicker({ kind, role, list, selected, onKind, onRole, onPick }: Props) {
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return list.filter((p) => (role === 'any' || p.role === role || p.role === 'both') && (!t || p.name.toLowerCase().includes(t))).sort((a, b) => b.projectCount - a.projectCount || a.name.localeCompare(b.name));
  }, [list, role, q]);
  const roles: (PartyRole | 'any')[] = ['any', 'lead', 'mep'];
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
      <input type="search" id="party-q" value={q} placeholder={`Search ${kind}s by name`} aria-label={`Search ${kind}s by name`} onChange={(e) => setQ(e.target.value)} />
      <p className="label" id="picker-count" data-count={rows.length}>
        {count(rows.length)} {kind}s
      </p>
      <ol className="plist" id="plist" aria-label={`${kind} list`}>
        {rows.map((p) => (
          <li key={p.id}>
            <button type="button" className={cx('plist-b', selected === p.id && 'on')} aria-pressed={selected === p.id} data-id={p.id} onClick={() => onPick(p.id)}>
              <span className="plist-name">{p.name}</span>
              <span className="plist-meta">
                {roleLabel(kind, p.role)} · {count(p.projectCount)} projects · AED {aedm(p.projectValue)} m
              </span>
            </button>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="empty">
            <strong>No {kind} matches.</strong> Try a shorter name or another role.
          </li>
        )}
      </ol>
    </div>
  );
}

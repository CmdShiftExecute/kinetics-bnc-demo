import type { Party, Rollup } from '../../data/schema';
import { BUCKETS } from '../../data/schema';
import type { Filters } from '../lib/filters';
import { EMPTY } from '../lib/filters';
import { dateLabel } from '../lib/format';

interface Chip {
  key: string;
  label: string;
  clear: Partial<Filters>;
}

export function chipsFor(f: Filters, rollup: Rollup, consultants: Party[], contractors: Party[]): Chip[] {
  const out: Chip[] = [];
  const lst = (key: 'sector' | 'industry' | 'type' | 'stage' | 'city' | 'category', prefix: string) => {
    for (const v of f[key]) out.push({ key: `${key}:${v}`, label: `${prefix}: ${v}`, clear: { [key]: f[key].filter((x) => x !== v) } as Partial<Filters> });
  };
  lst('sector', 'Sector');
  lst('industry', 'Industry');
  lst('type', 'Type');
  lst('stage', 'Stage');
  lst('city', 'City');
  lst('category', 'Category');
  if (f.vertical) {
    const name = rollup.verticals.find((v) => v.slug === f.vertical)?.name ?? f.vertical;
    out.push({ key: 'vertical', label: `${name}${f.floor != null ? ` at least ${f.floor.toFixed(1)}` : ''}`, clear: { vertical: null, floor: null, bucket: [] } });
  }
  for (const b of f.bucket) out.push({ key: `bucket:${b}`, label: `Activity: ${BUCKETS[b]}`, clear: { bucket: f.bucket.filter((x) => x !== b) } });
  if (f.year !== null) out.push({ key: 'year', label: `Activity in ${f.year}`, clear: { year: null } });
  if (f.owned !== null) out.push({ key: 'owned', label: f.owned ? 'Owned' : 'No owner', clear: { owned: null } });
  if (f.ownerVertical) out.push({ key: 'ownerVertical', label: `Owned by ${rollup.verticals.find(v => v.slug === f.ownerVertical)?.name ?? f.ownerVertical}`, clear: { ownerVertical: null } });
  if (f.chase) out.push({ key: 'chase', label: 'Worth chasing: all qualifying projects', clear: { chase: false } });
  if (f.omin !== null) out.push({ key: 'omin', label: `Overall relevance at least ${f.omin.toFixed(1)}`, clear: { omin: null } });
  if (f.cmin != null || f.cmax != null) out.push({ key: 'completion', label: `Completion ${f.cmin ?? 0}% to ${f.cmax ?? 100}%`, clear: { cmin: null, cmax: null } });
  if (f.vmin != null || f.vmax != null) out.push({ key: 'value', label: `Value AED ${f.vmin ?? 0} m to ${f.vmax != null ? `${f.vmax} m` : 'any'}`, clear: { vmin: null, vmax: null } });
  if (f.engineer) out.push({ key: 'engineer', label: `Owner: ${rollup.engineers.find((e) => e.slug === f.engineer)?.name ?? f.engineer}`, clear: { engineer: null } });
  if (f.consultant != null) out.push({ key: 'consultant', label: `Consultant: ${consultants.find((c) => c.id === f.consultant)?.name ?? f.consultant}`, clear: { consultant: null } });
  if (f.nocon) out.push({ key: 'nocon', label: 'No consultant recorded', clear: { nocon: false } });
  if (f.contractor != null) out.push({ key: 'contractor', label: `Contractor: ${contractors.find((c) => c.id === f.contractor)?.name ?? f.contractor}`, clear: { contractor: null } });
  if (f.nokon) out.push({ key: 'nokon', label: 'No contractor appointed', clear: { nokon: false } });
  if (f.umin != null || f.umax != null) out.push({ key: 'updated', label: `Updated ${f.umin ? dateLabel(f.umin) : 'any'} to ${f.umax ? dateLabel(f.umax) : 'any'}`, clear: { umin: null, umax: null } });
  if (f.q.trim()) out.push({ key: 'q', label: `Search: ${f.q.trim()}`, clear: { q: '' } });
  return out;
}

/** The active filters as removable chips, with "clear all". */
export function Chips({ chips, set, clearAll }: { chips: Chip[]; set: (patch: Partial<Filters>) => void; clearAll: () => void }) {
  if (chips.length === 0) return <p className="chips muted" id="chips" data-count={0}>No filters. Every project in the register is listed.</p>;
  return (
    <div className="chips" id="chips" data-count={chips.length} role="group" aria-label="Active filters">
      {chips.map((c) => (
        <button key={c.key} type="button" className="chip press" onClick={() => set(c.clear)} aria-label={`Remove filter ${c.label}`}>
          {c.label} <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="chip clear press" id="clear-all" onClick={clearAll}>
        Clear all
      </button>
    </div>
  );
}

export { EMPTY };

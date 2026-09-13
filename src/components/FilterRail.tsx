import { useMemo } from 'react';
import type { Party, Project, Rollup } from '../../data/schema';
import { BUCKETS, CATEGORIES, CITIES, SECTORS, STAGES } from '../../data/schema';
import type { Filters } from '../lib/filters';
import { matches } from '../lib/filters';
import { count, cx } from '../lib/format';

interface Props {
  rollup: Rollup;
  projects: Project[];
  consultants: Party[];
  contractors: Party[];
  filters: Filters;
  set: (patch: Partial<Filters>, push?: boolean) => void;
  vIndex: Map<string, number>;
  open: boolean;
}

/** One facet: a checkbox list with the count each choice would give, computed with the facet's own filter skipped. */
function Facet<T extends string>({ id, title, options, selected, counts, onChange, scroll }: { id: string; title: string; options: readonly T[]; selected: string[]; counts: Map<string, number>; onChange: (next: string[]) => void; scroll?: boolean }) {
  return (
    <fieldset className="facet" id={`facet-${id}`}>
      <legend className="label">{title}</legend>
      <div className={cx('facet-list', scroll && 'scroll')}>
        {options.map((o) => {
          const on = selected.includes(o);
          const n = counts.get(o) ?? 0;
          return (
            <label key={o} className={cx('facet-opt', n === 0 && !on && 'zero')}>
              <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))} data-facet={id} data-value={o} />
              <span className="facet-name">{o}</span>
              <span className="facet-n num">{count(n)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Range({ id, title, lo, hi, setLo, setHi, step = 1, placeholder = ['min', 'max'] as [string, string], type = 'number' }: { id: string; title: string; lo: string; hi: string; setLo: (v: string) => void; setHi: (v: string) => void; step?: number; placeholder?: [string, string]; type?: 'number' | 'date' }) {
  return (
    <fieldset className="facet" id={`facet-${id}`}>
      <legend className="label">{title}</legend>
      <div className="range">
        <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={step} min={0} value={lo} placeholder={placeholder[0]} aria-label={`${title} minimum`} onChange={(e) => setLo(e.target.value)} />
        <span aria-hidden="true">to</span>
        <input type={type} inputMode={type === 'number' ? 'decimal' : undefined} step={step} min={0} value={hi} placeholder={placeholder[1]} aria-label={`${title} maximum`} onChange={(e) => setHi(e.target.value)} />
      </div>
    </fieldset>
  );
}

/**
 * The persistent left filter rail. Every control writes the URL through `set`, so
 * the address bar is the state. Facet counts are what choosing an option would
 * yield with everything else in force.
 */
export function FilterRail({ rollup, projects, consultants, contractors, filters: f, set, vIndex, open }: Props) {
  const industries = useMemo(() => [...new Set(rollup.matrix.filter((r) => !f.sector.length || f.sector.includes(r.sector)).map((r) => r.industry))].sort(), [rollup, f.sector]);
  const types = useMemo(() => [...new Set(rollup.matrix.filter((r) => (!f.sector.length || f.sector.includes(r.sector)) && (!f.industry.length || f.industry.includes(r.industry))).map((r) => r.type))].sort(), [rollup, f.sector, f.industry]);
  const counts = (key: keyof Filters, get: (p: Project) => string | string[]) => {
    const m = new Map<string, number>();
    for (const p of projects) {
      if (!matches(p, f, vIndex, key)) continue;
      const v = get(p);
      for (const x of Array.isArray(v) ? v : [v]) m.set(x, (m.get(x) ?? 0) + 1);
    }
    return m;
  };
  const vi = f.vertical ? vIndex.get(f.vertical) : undefined;
  const sectorCounts = useMemo(() => counts('sector', (p) => p.sector), [projects, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const stageCounts = useMemo(() => counts('stage', (p) => p.stage), [projects, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const industryCounts = useMemo(() => counts('industry', (p) => p.industry), [projects, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const typeCounts = useMemo(() => counts('type', (p) => p.type), [projects, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const cityCounts = useMemo(() => counts('city', (p) => p.city), [projects, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const catCounts = useMemo(() => counts('category', (p) => p.category), [projects, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const bucketCounts = useMemo(() => counts('bucket', (p) => (vi !== undefined ? [BUCKETS[p.buckets[vi]!]!] : [...new Set(p.buckets.map((b) => BUCKETS[b]!))])), [projects, f, vi]); // eslint-disable-line react-hooks/exhaustive-deps
  const bucketNames = BUCKETS as readonly string[];
  const s = (n: number | null) => (n == null ? '' : String(n));
  const numOrNull = (v: string) => (v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  const partyName = (list: Party[], id: number | null) => (id == null ? '' : (list.find((p) => p.id === id)?.name ?? ''));
  return (
    <aside className={cx('rail', !open && 'closed')} id="rail" aria-label="Filters" aria-hidden={!open}>
      <div className="rail-in">
        <fieldset className="facet" id="facet-q">
          <legend className="label">Search</legend>
          <input type="search" id="q" value={f.q} placeholder="Project name or reference" aria-label="Search by project name or reference" onChange={(e) => set({ q: e.target.value }, false)} />
        </fieldset>
        <Facet id="sector" title="Sector" options={SECTORS} selected={f.sector} counts={sectorCounts} onChange={(v) => set({ sector: v, industry: [], type: [] })} />
        <Facet id="stage" title="Stage" options={STAGES} selected={f.stage} counts={stageCounts} onChange={(v) => set({ stage: v })} />
        <fieldset className="facet" id="facet-vertical">
          <legend className="label">Vertical relevance</legend>
          <select className="pick" id="v-pick" value={f.vertical ?? ''} aria-label="Vertical" onChange={(e) => set({ vertical: e.target.value || null, floor: e.target.value ? (f.floor ?? 4) : null, bucket: [] })}>
            <option value="">Any vertical</option>
            {rollup.verticals.map((v) => (
              <option key={v.slug} value={v.slug}>
                {v.name}
              </option>
            ))}
          </select>
          {f.vertical && (
            <label className="floor">
              <span>Score at least</span>
              <input type="number" id="v-floor" min={0} max={8} step={0.5} value={s(f.floor)} aria-label="Minimum score on the chosen vertical" onChange={(e) => set({ floor: numOrNull(e.target.value) }, false)} />
            </label>
          )}
        </fieldset>
        <Facet id="bucket" title={f.vertical ? `Activity on ${rollup.verticals[vi!]!.name}` : 'Activity bucket (any vertical)'} options={bucketNames} selected={f.bucket.map((b) => BUCKETS[b]!)} counts={bucketCounts} onChange={(v) => set({ bucket: v.map((n) => bucketNames.indexOf(n)).filter((i) => i >= 0) as Filters['bucket'] })} scroll />
        <fieldset className="facet" id="facet-engineer">
          <legend className="label">Owner engineer</legend>
          <select className="pick" id="eng-pick" value={f.engineer ?? ''} aria-label="Owner engineer" onChange={(e) => set({ engineer: e.target.value || null })}>
            <option value="">Any owner</option>
            {rollup.engineers.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        </fieldset>
        <Range id="value" title="Value, AED million" lo={s(f.vmin)} hi={s(f.vmax)} setLo={(v) => set({ vmin: numOrNull(v) }, false)} setHi={(v) => set({ vmax: numOrNull(v) }, false)} step={0.1} />
        <Range id="completion" title="Completion, percent" lo={s(f.cmin)} hi={s(f.cmax)} setLo={(v) => set({ cmin: numOrNull(v) }, false)} setHi={(v) => set({ cmax: numOrNull(v) }, false)} step={0.1} />
        <Facet id="city" title="City" options={CITIES} selected={f.city} counts={cityCounts} onChange={(v) => set({ city: v })} />
        <Facet id="category" title="Category" options={CATEGORIES} selected={f.category} counts={catCounts} onChange={(v) => set({ category: v })} />
        <Facet id="industry" title="Industry" options={industries} selected={f.industry} counts={industryCounts} onChange={(v) => set({ industry: v, type: [] })} scroll />
        <Facet id="type" title="Project type" options={types} selected={f.type} counts={typeCounts} onChange={(v) => set({ type: v })} scroll />
        <fieldset className="facet" id="facet-consultant">
          <legend className="label">Consultant</legend>
          <input list="consultant-list" id="con-pick" placeholder="Type a consultant name" aria-label="Consultant" defaultValue={partyName(consultants, f.consultant)} key={`con-${f.consultant ?? ''}`} onChange={(e) => {
            const hit = consultants.find((c) => c.name === e.target.value);
            if (hit) set({ consultant: hit.id });
            else if (e.target.value === '') set({ consultant: null });
          }} />
          <datalist id="consultant-list">
            {consultants.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </fieldset>
        <fieldset className="facet" id="facet-contractor">
          <legend className="label">Contractor</legend>
          <input list="contractor-list" id="kon-pick" placeholder="Type a contractor name" aria-label="Contractor" defaultValue={partyName(contractors, f.contractor)} key={`kon-${f.contractor ?? ''}`} onChange={(e) => {
            const hit = contractors.find((c) => c.name === e.target.value);
            if (hit) set({ contractor: hit.id });
            else if (e.target.value === '') set({ contractor: null });
          }} />
          <datalist id="contractor-list">
            {contractors.map((c) => (
              <option key={c.id} value={c.name} />
            ))}
          </datalist>
        </fieldset>
        <Range id="updated" title="Last updated" lo={f.umin ?? ''} hi={f.umax ?? ''} setLo={(v) => set({ umin: v || null }, false)} setHi={(v) => set({ umax: v || null }, false)} type="date" placeholder={['from', 'to']} />
      </div>
    </aside>
  );
}

/**
 * The Projects page filter state: one object, encoded in the URL so any view is a
 * shareable link, decoded back on load. Unknown keys are ignored; malformed values
 * fall back to "no filter" rather than throwing. The same predicate runs for the
 * facet counts, the table, the CSV export, the view cards, every headline card's
 * drill link and the interaction gate's predictions, so a card and the register it
 * opens can never disagree about who is in the population.
 *
 * Population predicates a headline card needs, all in this one contract:
 *   owned   (owned=1 | owned=0)  projects with an owner, or with none
 *   omin    (omin=6.5)           overall relevance at or above a floor ("reading High" is 6.5)
 *   year    (year=2026)          activity pairs dated in that year; with `bucket`, the pair must be in the bucket AND the year
 *   nocon   (nocon=1)            no lead and no MEP consultant recorded
 *   nokon   (nokon=1)            no main and no MEP contractor appointed
 */
import type { BucketCode, Project, Rollup } from '../../data/schema';
import { BUCKETS, CATEGORIES, CITIES, SECTORS, STAGES } from '../../data/schema';

export type SortKey = 'ref' | 'name' | 'stage' | 'completionPct' | 'value' | 'city' | 'sector' | 'industry' | 'type' | 'overall' | 'owner' | 'lastUpdated' | 'score';
export type SortDir = 'asc' | 'desc';

export interface Filters {
  sector: string[];
  industry: string[];
  type: string[];
  stage: string[];
  city: string[];
  category: string[];
  bucket: BucketCode[];
  /** Completion percent range, inclusive; null bound means open. */
  cmin: number | null;
  cmax: number | null;
  /** Value range in AED million, inclusive. */
  vmin: number | null;
  vmax: number | null;
  /** Vertical slug and the minimum score on it. */
  vertical: string | null;
  floor: number | null;
  engineer: string | null;
  consultant: number | null;
  contractor: number | null;
  /** Last updated range, ISO dates inclusive. */
  umin: string | null;
  umax: string | null;
  q: string;
  /** Owned (true), no owner (false), or either (null). */
  owned: boolean | null;
  /** Overall relevance at or above this. */
  omin: number | null;
  /** Activity pairs must be dated in this calendar year. */
  year: number | null;
  /** No consultant recorded (lead and MEP both absent). */
  nocon: boolean;
  /** No contractor appointed (main and MEP both absent). */
  nokon: boolean;
  sort: SortKey;
  dir: SortDir;
}

export const EMPTY: Filters = { sector: [], industry: [], type: [], stage: [], city: [], category: [], bucket: [], cmin: null, cmax: null, vmin: null, vmax: null, vertical: null, floor: null, engineer: null, consultant: null, contractor: null, umin: null, umax: null, q: '', owned: null, omin: null, year: null, nocon: false, nokon: false, sort: 'value', dir: 'desc' };

/** The score at which a vertical score, or the overall relevance, reads High (rules.ts gradeOf). */
export const HIGH_FLOOR = 6.5;

const SORT_KEYS: SortKey[] = ['ref', 'name', 'stage', 'completionPct', 'value', 'city', 'sector', 'industry', 'type', 'overall', 'owner', 'lastUpdated', 'score'];
const list = (sp: URLSearchParams, key: string, allowed?: readonly string[]) =>
  sp
    .getAll(key)
    .flatMap((v) => v.split('|'))
    .map((v) => v.trim())
    .filter((v) => v && (!allowed || allowed.includes(v)));
const num = (sp: URLSearchParams, key: string) => {
  const v = sp.get(key);
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const iso = (sp: URLSearchParams, key: string) => {
  const v = sp.get(key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null;
};
const flag = (sp: URLSearchParams, key: string) => sp.get(key) === '1';

export function parseFilters(sp: URLSearchParams, rollup: Rollup): Filters {
  const verticalSlugs = rollup.verticals.map((v) => v.slug);
  const industries = [...new Set(rollup.matrix.map((r) => r.industry))];
  const types = [...new Set(rollup.matrix.map((r) => r.type))];
  const engineer = sp.get('eng');
  const vertical = sp.get('v');
  const sort = sp.get('sort');
  const dir = sp.get('dir');
  const cmin = num(sp, 'cmin');
  const cmax = num(sp, 'cmax');
  const vmin = num(sp, 'vmin');
  const vmax = num(sp, 'vmax');
  const consultant = num(sp, 'con');
  const contractor = num(sp, 'kon');
  const ownedRaw = sp.get('owned');
  const omin = num(sp, 'omin');
  const year = num(sp, 'year');
  return {
    sector: list(sp, 'sector', SECTORS),
    industry: list(sp, 'industry', industries),
    type: list(sp, 'type', types),
    stage: list(sp, 'stage', STAGES),
    city: list(sp, 'city', CITIES),
    category: list(sp, 'cat', CATEGORIES),
    bucket: list(sp, 'bucket')
      .map(Number)
      .filter((n) => Number.isInteger(n) && n >= 0 && n < BUCKETS.length) as BucketCode[],
    cmin: cmin === null ? null : Math.max(0, Math.min(100, cmin)),
    cmax: cmax === null ? null : Math.max(0, Math.min(100, cmax)),
    vmin: vmin === null ? null : Math.max(0, vmin),
    vmax: vmax === null ? null : Math.max(0, vmax),
    vertical: vertical && verticalSlugs.includes(vertical) ? vertical : null,
    floor: num(sp, 'floor'),
    engineer: engineer && rollup.engineers.some((e) => e.slug === engineer) ? engineer : null,
    consultant: consultant !== null && Number.isInteger(consultant) && consultant > 0 ? consultant : null,
    contractor: contractor !== null && Number.isInteger(contractor) && contractor > 0 ? contractor : null,
    umin: iso(sp, 'umin'),
    umax: iso(sp, 'umax'),
    q: (sp.get('q') ?? '').slice(0, 80),
    owned: ownedRaw === '1' ? true : ownedRaw === '0' ? false : null,
    omin: omin === null ? null : Math.max(0, Math.min(8, omin)),
    year: year !== null && Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    nocon: flag(sp, 'nocon'),
    nokon: flag(sp, 'nokon'),
    sort: sort && SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'value',
    dir: dir === 'asc' || dir === 'desc' ? dir : 'desc',
  };
}

export function serialiseFilters(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  const put = (k: string, v: string | number | null | undefined) => {
    if (v !== null && v !== undefined && v !== '') sp.set(k, String(v));
  };
  if (f.sector.length) sp.set('sector', f.sector.join('|'));
  if (f.industry.length) sp.set('industry', f.industry.join('|'));
  if (f.type.length) sp.set('type', f.type.join('|'));
  if (f.stage.length) sp.set('stage', f.stage.join('|'));
  if (f.city.length) sp.set('city', f.city.join('|'));
  if (f.category.length) sp.set('cat', f.category.join('|'));
  if (f.bucket.length) sp.set('bucket', f.bucket.join('|'));
  put('cmin', f.cmin);
  put('cmax', f.cmax);
  put('vmin', f.vmin);
  put('vmax', f.vmax);
  put('v', f.vertical);
  if (f.vertical) put('floor', f.floor);
  put('eng', f.engineer);
  put('con', f.consultant);
  put('kon', f.contractor);
  put('umin', f.umin);
  put('umax', f.umax);
  put('q', f.q.trim());
  if (f.owned !== null) sp.set('owned', f.owned ? '1' : '0');
  put('omin', f.omin);
  put('year', f.year);
  if (f.nocon) sp.set('nocon', '1');
  if (f.nokon) sp.set('nokon', '1');
  if (f.sort !== 'value') sp.set('sort', f.sort);
  if (f.dir !== 'desc') sp.set('dir', f.dir);
  return sp;
}

/** Number of filters in force, for the chips row and the "clear all" affordance. */
export function activeCount(f: Filters): number {
  let n = f.sector.length + f.industry.length + f.type.length + f.stage.length + f.city.length + f.category.length + f.bucket.length;
  if (f.cmin !== null || f.cmax !== null) n++;
  if (f.vmin !== null || f.vmax !== null) n++;
  if (f.vertical) n++;
  if (f.engineer) n++;
  if (f.consultant) n++;
  if (f.contractor) n++;
  if (f.umin !== null || f.umax !== null) n++;
  if (f.q.trim()) n++;
  if (f.owned !== null) n++;
  if (f.omin !== null) n++;
  if (f.year !== null) n++;
  if (f.nocon) n++;
  if (f.nokon) n++;
  return n;
}

/**
 * Whether one (project, vertical) pair satisfies the activity part of the filter: the
 * bucket list, if any, and the activity year, if any. With neither in force every pair
 * qualifies. One predicate for the table, the view cards and the facet counts.
 */
export function pairMatches(p: Project, vi: number, f: Filters, skipBucket = false): boolean {
  if (!skipBucket && f.bucket.length && !f.bucket.includes(p.buckets[vi]!)) return false;
  if (f.year !== null && !p.bucketDates[vi]!.startsWith(String(f.year))) return false;
  return true;
}

/** The predicate, with one facet optionally skipped so a facet's own counts show what choosing it would give. */
export function matches(p: Project, f: Filters, vIndex: Map<string, number>, skip?: keyof Filters): boolean {
  if (skip !== 'sector' && f.sector.length && !f.sector.includes(p.sector)) return false;
  if (skip !== 'industry' && f.industry.length && !f.industry.includes(p.industry)) return false;
  if (skip !== 'type' && f.type.length && !f.type.includes(p.type)) return false;
  if (skip !== 'stage' && f.stage.length && !f.stage.includes(p.stage)) return false;
  if (skip !== 'city' && f.city.length && !f.city.includes(p.city)) return false;
  if (skip !== 'category' && f.category.length && !f.category.includes(p.category)) return false;
  if (f.cmin !== null || f.cmax !== null) {
    const c = p.completionPct ?? 0;
    if (f.cmin !== null && c < f.cmin) return false;
    if (f.cmax !== null && c > f.cmax) return false;
  }
  if (f.vmin !== null && p.value < f.vmin) return false;
  if (f.vmax !== null && p.value > f.vmax) return false;
  const activity = (skip !== 'bucket' && f.bucket.length > 0) || f.year !== null;
  if (f.vertical) {
    const vi = vIndex.get(f.vertical);
    const s = vi === undefined ? null : p.scores[vi];
    if (s == null) return false;
    if (f.floor !== null && s < f.floor) return false;
    if (activity && vi !== undefined && !pairMatches(p, vi, f, skip === 'bucket')) return false;
  } else if (activity && !p.buckets.some((_b, vi) => pairMatches(p, vi, f, skip === 'bucket'))) return false;
  if (f.engineer && p.ownerEngineer !== f.engineer) return false;
  if (f.consultant !== null && !p.leadConsultants.includes(f.consultant) && p.mepConsultant !== f.consultant) return false;
  if (f.contractor !== null && !p.mainContractors.includes(f.contractor) && p.mepContractor !== f.contractor) return false;
  if (f.umin !== null && p.lastUpdated < f.umin) return false;
  if (f.umax !== null && p.lastUpdated > f.umax) return false;
  if (skip !== 'owned' && f.owned !== null && (p.ownerVertical != null) !== f.owned) return false;
  if (f.omin !== null && (p.overall == null || p.overall < f.omin)) return false;
  if (f.nocon && (p.leadConsultants.length > 0 || p.mepConsultant != null)) return false;
  if (f.nokon && (p.mainContractors.length > 0 || p.mepContractor != null)) return false;
  if (f.q.trim()) {
    const q = f.q.trim().toLowerCase();
    if (!p.name.toLowerCase().includes(q) && !p.ref.toLowerCase().includes(q)) return false;
  }
  return true;
}

/**
 * Pairs in the given buckets on the rows in view, honouring the vertical and the activity
 * year of the filter: with a vertical chosen only that vertical's pair counts; with a year,
 * only pairs dated in it. This is what makes "Orders received 2026" on the Overview equal
 * the Orders card of the register it opens.
 */
export function countPairs(rows: Project[], f: Filters, vIndex: Map<string, number>, codes: number[]): number {
  const vi = f.vertical ? (vIndex.get(f.vertical) ?? null) : null;
  const yr = f.year === null ? null : String(f.year);
  let n = 0;
  for (const p of rows) {
    if (vi != null) {
      if (codes.includes(p.buckets[vi]!) && (yr === null || p.bucketDates[vi]!.startsWith(yr))) n++;
    } else p.buckets.forEach((b, i) => (codes.includes(b) && (yr === null || p.bucketDates[i]!.startsWith(yr)) ? n++ : 0));
  }
  return n;
}

export function sortProjects(rows: Project[], f: Filters, vIndex: Map<string, number>, engineerName: Map<string, string>): Project[] {
  const vi = f.vertical ? vIndex.get(f.vertical) : undefined;
  const key = (p: Project): number | string => {
    switch (f.sort) {
      case 'ref':
        return p.ref;
      case 'name':
        return p.name;
      case 'stage':
        return STAGES.indexOf(p.stage);
      case 'completionPct':
        return p.completionPct ?? -1;
      case 'value':
        return p.value;
      case 'city':
        return p.city;
      case 'sector':
        return p.sector;
      case 'industry':
        return p.industry;
      case 'type':
        return p.type;
      case 'overall':
        return p.overall ?? -1;
      case 'owner':
        return p.ownerEngineer ? (engineerName.get(p.ownerEngineer) ?? '') : '';
      case 'lastUpdated':
        return p.lastUpdated;
      case 'score':
        return vi === undefined ? -1 : (p.scores[vi] ?? -1);
    }
  };
  const out = [...rows];
  out.sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return (f.dir === 'asc' ? c : -c) || a.ref.localeCompare(b.ref);
  });
  return out;
}

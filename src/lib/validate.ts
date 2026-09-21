/**
 * Shape validation at the data boundary. Valid JSON of the wrong shape must produce a
 * readable error, never a blank page and never a figure computed from a corrupt row.
 *
 * Every row of every file is checked, not a sample: field types, the ten-long score,
 * bucket and date vectors, score and bucket domains, the closed vocabularies (stage,
 * sector, city, category, grade, gate, tie rule) and the relationship state. Cross-file
 * references (party ids, engineer slugs, vertical indexes) are checked in register.ts
 * once every file has loaded, because a shard cannot know the party files on its own.
 */
import { BUCKETS, CATEGORIES, CITIES, GRADES, SECTORS, STAGES } from '../../data/schema';

export class DataShapeError extends Error {
  constructor(file: string, detail: string) {
    super(`${file} does not have the expected shape: ${detail}.`);
    this.name = 'DataShapeError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const oneDecimal = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;

function need(file: string, o: unknown, keys: string[], path = ''): asserts o is Obj {
  if (!isObj(o)) throw new DataShapeError(file, `${path || 'root'} is not an object`);
  for (const key of keys) if (!(key in o)) throw new DataShapeError(file, `missing ${path ? path + '.' : ''}${key}`);
}
function needArray(file: string, v: unknown, path: string, min = 0, exact?: number): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new DataShapeError(file, `${path} is not an array`);
  if (exact !== undefined && v.length !== exact) throw new DataShapeError(file, `${path} has ${v.length} entries, expected exactly ${exact}`);
  if (v.length < min) throw new DataShapeError(file, `${path} has ${v.length} rows, expected at least ${min}`);
}
function needNumber(file: string, v: unknown, path: string, lo = -Infinity, hi = Infinity): asserts v is number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DataShapeError(file, `${path} is not a finite number`);
  if (v < lo || v > hi) throw new DataShapeError(file, `${path} is ${v}, outside ${lo} to ${hi}`);
}
function needInt(file: string, v: unknown, path: string, lo = -Infinity, hi = Infinity): asserts v is number {
  needNumber(file, v, path, lo, hi);
  if (!Number.isInteger(v)) throw new DataShapeError(file, `${path} is not a whole number`);
}
function needString(file: string, v: unknown, path: string, nonEmpty = true): asserts v is string {
  if (typeof v !== 'string' || (nonEmpty && v.length === 0)) throw new DataShapeError(file, `${path} is not a string`);
}
function needOneOf(file: string, v: unknown, path: string, allowed: readonly string[]) {
  if (typeof v !== 'string' || !allowed.includes(v)) throw new DataShapeError(file, `${path} is not one of ${allowed.join(', ')}`);
}
function needDate(file: string, v: unknown, path: string) {
  if (!isoDate(v)) throw new DataShapeError(file, `${path} is not a calendar date`);
}
function needIdList(file: string, v: unknown, path: string, max: number) {
  needArray(file, v, path, 0);
  if (v.length > max) throw new DataShapeError(file, `${path} lists ${v.length} ids, at most ${max} allowed`);
  v.forEach((x, i) => needInt(file, x, `${path}[${i}]`, 1));
}
function needNullableInt(file: string, v: unknown, path: string, lo: number, hi = Infinity) {
  if (v !== null) needInt(file, v, path, lo, hi);
}

/** Keys that may legitimately be null. */
const NULLABLE = new Set(['completionPct', 'completionDate', 'mepConsultant', 'mepContractor', 'overall', 'ownerVertical', 'ownerEngineer', 'door', 'tieRule', 'level', 'rating', 'owner']);
/** Walks a subtree: every leaf must be a finite number, a string or a boolean; null only under a nullable key or inside a scores vector. */
function needFiniteLeaves(file: string, v: unknown, path: string, nullOk = false) {
  if (v === null || v === undefined) {
    if (nullOk) return;
    throw new DataShapeError(file, `${path} is empty where a value is expected`);
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new DataShapeError(file, `${path} is not a finite number`);
    return;
  }
  if (typeof v === 'string' || typeof v === 'boolean') return;
  if (Array.isArray(v)) {
    v.forEach((x, i) => needFiniteLeaves(file, x, `${path}[${i}]`, path.endsWith('scores')));
    return;
  }
  if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) needFiniteLeaves(file, x, `${path}.${k}`, NULLABLE.has(k));
    return;
  }
  throw new DataShapeError(file, `${path} has an unexpected value`);
}

const ROLLUP_KEYS = ['meta', 'verticals', 'engineers', 'matrix', 'matrixRows', 'shards', 'kpis', 'sectorStage', 'chase', 'verticalSummary', 'engineerSummary', 'funnel', 'funnelProjects', 'parties', 'definitions', 'precisionPolicy', 'assumptions', 'cascade', 'bucketRule', 'workloadRule', 'relationshipRule', 'shape', 'distributions', 'matrixSummary', 'partySummary', 'engineerCapacity', 'workloadWeights'];

export function validateRollup(file: string, v: unknown) {
  need(file, v, ROLLUP_KEYS);
  need(file, v.meta, ['company', 'division', 'system', 'dataAsOf', 'dataAsOfLabel', 'fiscalYear', 'currency', 'unit', 'seed'], 'meta');
  needArray(file, v.verticals, 'verticals', 1);
  needArray(file, v.engineers, 'engineers', 1);
  needArray(file, v.matrix, 'matrix', 1);
  needArray(file, v.shards, 'shards', 1);
  need(file, v.kpis, ['projects', 'owned', 'ownedValue', 'openEnquiriesAndQuotes', 'ordersThisYear', 'unowned'], 'kpis');
  for (const k of ['projects', 'owned', 'ownedValue', 'openEnquiriesAndQuotes', 'ordersThisYear', 'unowned']) needNumber(file, (v.kpis as Obj)[k], `kpis.${k}`);
  needArray(file, v.funnel, 'funnel', BUCKETS.length, BUCKETS.length);
  const V = (v.verticals as unknown[]).length;
  (v.verticals as unknown[]).forEach((x, i) => {
    need(file, x, ['slug', 'name', 'channel'], `verticals[${i}]`);
    needString(file, x.slug, `verticals[${i}].slug`);
    needOneOf(file, x.channel, `verticals[${i}].channel`, ['consultants', 'contractors', 'both']);
  });
  const slugs = new Set((v.verticals as { slug: string }[]).map((x) => x.slug));
  (v.engineers as unknown[]).forEach((e, i) => {
    need(file, e, ['slug', 'name', 'vertical'], `engineers[${i}]`);
    needString(file, e.slug, `engineers[${i}].slug`);
    if (!slugs.has(e.vertical as string)) throw new DataShapeError(file, `engineers[${i}].vertical names an unknown vertical`);
  });
  (v.matrix as unknown[]).forEach((r, i) => {
    need(file, r, ['sector', 'industry', 'type', 'cells'], `matrix[${i}]`);
    needOneOf(file, r.sector, `matrix[${i}].sector`, SECTORS);
    needArray(file, r.cells, `matrix[${i}].cells`, V, V);
    r.cells.forEach((c, j) => {
      if (c !== null) needOneOf(file, c, `matrix[${i}].cells[${j}]`, GRADES);
    });
  });
  needArray(file, v.matrixRows, 'matrixRows', (v.matrix as unknown[]).length, (v.matrix as unknown[]).length);
  needArray(file, v.engineerSummary, 'engineerSummary', 1);
  (v.engineerSummary as unknown[]).forEach((e, i) => {
    need(file, e, ['slug', 'owned', 'ownedValue', 'funnel', 'workload', 'capacity', 'loadPct', 'overloaded'], `engineerSummary[${i}]`);
    needArray(file, e.funnel, `engineerSummary[${i}].funnel`, BUCKETS.length, BUCKETS.length);
    needNumber(file, e.workload, `engineerSummary[${i}].workload`, 0);
    needNumber(file, e.capacity, `engineerSummary[${i}].capacity`, 1);
    if (typeof e.overloaded !== 'boolean') throw new DataShapeError(file, `engineerSummary[${i}].overloaded is not true or false`);
  });
  needArray(file, v.shape, 'shape', 1);
  (v.shape as unknown[]).forEach((s, i) => {
    need(file, s, ['key', 'label', 'measured', 'lo', 'hi', 'unit', 'basis', 'pass'], `shape[${i}]`);
    needNumber(file, s.measured, `shape[${i}].measured`);
    needNumber(file, s.lo, `shape[${i}].lo`);
    needNumber(file, s.hi, `shape[${i}].hi`);
  });
  needFiniteLeaves(file, v.kpis, 'kpis');
  needFiniteLeaves(file, v.verticalSummary, 'verticalSummary');
  needFiniteLeaves(file, v.engineerSummary, 'engineerSummary');
  needFiniteLeaves(file, v.sectorStage, 'sectorStage');
  needFiniteLeaves(file, v.matrixSummary, 'matrixSummary');
  needFiniteLeaves(file, v.partySummary, 'partySummary');
}

const PROJECT_KEYS = ['ref', 'name', 'stage', 'completionPct', 'completionDate', 'value', 'city', 'sector', 'category', 'industry', 'type', 'location', 'source', 'attributes', 'owners', 'leadConsultants', 'mepConsultant', 'mainContractors', 'mepContractor', 'description', 'lastUpdated', 'scores', 'adjusted', 'overall', 'ownerVertical', 'ownerEngineer', 'why', 'buckets', 'bucketDates'];
const GATES = ['specification', 'buying', 'appointed', 'held', 'none'];

/**
 * Every row of a shard, in full. `V` is the vertical count from the rollup, so a row
 * with nine scores, or a score of 9.0, or a bucket code of 99, or a string where a number
 * belongs, is refused before it can reach a card or a chart.
 */
export function validateShard(file: string, v: unknown, V: number) {
  need(file, v, ['sector', 'projects']);
  needOneOf(file, v.sector, 'sector', SECTORS);
  needArray(file, v.projects, 'projects', 1);
  const refs = new Set<string>();
  (v.projects as unknown[]).forEach((p, i) => {
    const at = `projects[${i}]`;
    need(file, p, PROJECT_KEYS, at);
    needString(file, p.ref, `${at}.ref`);
    if (!/^[A-Z]{2}[A-HJ-NP-Z2-9]{7}$/.test(p.ref)) throw new DataShapeError(file, `${at}.ref "${p.ref}" is not a published project reference`);
    if (refs.has(p.ref)) throw new DataShapeError(file, `${at}.ref "${p.ref}" appears twice`);
    refs.add(p.ref);
    needString(file, p.name, `${at}.name`);
    needOneOf(file, p.stage, `${at}.stage`, STAGES);
    if (p.completionPct !== null) needNumber(file, p.completionPct, `${at}.completionPct`, 0, 100);
    if (p.stage !== 'Under Construction' && p.completionPct !== null) throw new DataShapeError(file, `${at}.completionPct must be recorded for Under Construction only`);
    if (p.completionDate !== null) needDate(file, p.completionDate, `${at}.completionDate`);
    needNumber(file, p.value, `${at}.value`, 0);
    if (!oneDecimal(p.value)) throw new DataShapeError(file, `${at}.value is not USD million to one decimal`);
    needOneOf(file, p.city, `${at}.city`, CITIES);
    if (p.sector !== v.sector) throw new DataShapeError(file, `${at}.sector differs from the shard's sector`);
    needOneOf(file, p.category, `${at}.category`, CATEGORIES);
    needString(file, p.industry, `${at}.industry`);
    needString(file, p.type, `${at}.type`);
    needString(file, p.location, `${at}.location`, false);
    needOneOf(file, p.source, `${at}.source`, ['urban_industrial', 'other_sectors', 'brownfield']);
    needArray(file, p.attributes, `${at}.attributes`);
    p.attributes.forEach((a, j) => needString(file, a, `${at}.attributes[${j}]`));
    needIdList(file, p.owners, `${at}.owners`, 2);
    needIdList(file, p.leadConsultants, `${at}.leadConsultants`, 2);
    needNullableInt(file, p.mepConsultant, `${at}.mepConsultant`, 1);
    needIdList(file, p.mainContractors, `${at}.mainContractors`, 2);
    needNullableInt(file, p.mepContractor, `${at}.mepContractor`, 1);
    needString(file, p.description, `${at}.description`);
    needDate(file, p.lastUpdated, `${at}.lastUpdated`);
    needArray(file, p.scores, `${at}.scores`, V, V);
    p.scores.forEach((s, j) => {
      if (s !== null) {
        needNumber(file, s, `${at}.scores[${j}]`, 0, 8);
        if (!oneDecimal(s)) throw new DataShapeError(file, `${at}.scores[${j}] is not to one decimal`);
      }
    });
    needArray(file, p.adjusted, `${at}.adjusted`, 0, undefined);
    p.adjusted.forEach((a, j) => needInt(file, a, `${at}.adjusted[${j}]`, 0, V - 1));
    const graded = (p.scores as (number | null)[]).filter((s): s is number => s !== null);
    if (p.overall !== null) needNumber(file, p.overall, `${at}.overall`, 0, 8);
    if ((p.overall === null) !== (graded.length === 0)) throw new DataShapeError(file, `${at}.overall disagrees with the scores`);
    if (p.overall !== null && p.overall !== Math.max(...graded)) throw new DataShapeError(file, `${at}.overall is not the highest score`);
    needNullableInt(file, p.ownerVertical, `${at}.ownerVertical`, 0, V - 1);
    if (p.ownerEngineer !== null) needString(file, p.ownerEngineer, `${at}.ownerEngineer`);
    if ((p.ownerVertical === null) !== (p.ownerEngineer === null)) throw new DataShapeError(file, `${at} has an owner vertical without an engineer or the reverse`);
    need(file, p.why, ['eligible', 'gate', 'candidates', 'tie', 'tied', 'assignedAtDecision', 'tieRule'], `${at}.why`);
    needOneOf(file, p.why.gate, `${at}.why.gate`, GATES);
    for (const k of ['eligible', 'candidates', 'tied'] as const) {
      needArray(file, p.why[k], `${at}.why.${k}`);
      (p.why[k] as unknown[]).forEach((x, j) => needInt(file, x, `${at}.why.${k}[${j}]`, 0, V - 1));
    }
    needArray(file, p.why.assignedAtDecision, `${at}.why.assignedAtDecision`, 0, (p.why.tied as unknown[]).length);
    (p.why.assignedAtDecision as unknown[]).forEach((x, j) => needInt(file, x, `${at}.why.assignedAtDecision[${j}]`, 0));
    if (typeof p.why.tie !== 'boolean') throw new DataShapeError(file, `${at}.why.tie is not true or false`);
    if (p.why.tieRule !== null) needOneOf(file, p.why.tieRule, `${at}.why.tieRule`, ['fewer', 'order']);
    if (p.why.tie !== ((p.why.tied as unknown[]).length > 1) || p.why.tie !== (p.why.tieRule !== null)) throw new DataShapeError(file, `${at}.why tie record is inconsistent`);
    needArray(file, p.buckets, `${at}.buckets`, V, V);
    p.buckets.forEach((b, j) => needInt(file, b, `${at}.buckets[${j}]`, 0, BUCKETS.length - 1));
    needArray(file, p.bucketDates, `${at}.bucketDates`, V, V);
    p.bucketDates.forEach((d, j) => needDate(file, d, `${at}.bucketDates[${j}]`));
  });
}

const PARTY_KEYS = ['id', 'name', 'kind', 'role', 'verticalCounts', 'verticalValues', 'level', 'rating', 'owner', 'projectCount', 'projectValue', 'projects'];
const LEVELS = ['Junior management', 'Middle management', 'Senior management'];

/** Every party row: types, domains, ten-long vertical vectors, and a relationship that is whole or absent. */
export function validateParties(file: string, v: unknown, V: number) {
  needArray(file, v, 'root', 1);
  const ids = new Set<number>();
  (v as unknown[]).forEach((p, i) => {
    const at = `[${i}]`;
    need(file, p, PARTY_KEYS, at);
    needInt(file, p.id, `${at}.id`, 1);
    if (ids.has(p.id)) throw new DataShapeError(file, `${at}.id ${p.id} appears twice`);
    ids.add(p.id);
    needString(file, p.name, `${at}.name`);
    needOneOf(file, p.kind, `${at}.kind`, ['consultant', 'contractor']);
    needOneOf(file, p.role, `${at}.role`, ['lead', 'mep', 'both']);
    needArray(file, p.verticalCounts, `${at}.verticalCounts`, V, V);
    p.verticalCounts.forEach((c, j) => needInt(file, c, `${at}.verticalCounts[${j}]`, 0));
    needArray(file, p.verticalValues, `${at}.verticalValues`, V, V);
    p.verticalValues.forEach((c, j) => needNumber(file, c, `${at}.verticalValues[${j}]`, 0));
    if (p.level !== null) needOneOf(file, p.level, `${at}.level`, LEVELS);
    if (p.rating !== null) needInt(file, p.rating, `${at}.rating`, 1, 10);
    if (p.owner !== null) needString(file, p.owner, `${at}.owner`);
    const held = p.level !== null;
    if (held !== (p.rating !== null) || held !== (p.owner !== null)) throw new DataShapeError(file, `${at} relationship is partly recorded: level, rating and owner must all be set or all be null`);
    needInt(file, p.projectCount, `${at}.projectCount`, 1);
    needNumber(file, p.projectValue, `${at}.projectValue`, 0);
    needArray(file, p.projects, `${at}.projects`, 1, p.projectCount);
    p.projects.forEach((r, j) => needString(file, r, `${at}.projects[${j}]`));
    if (Math.max(...(p.verticalCounts as number[])) > p.projectCount) throw new DataShapeError(file, `${at}.verticalCounts exceeds the project count`);
  });
}

export function validateOwners(file: string, v: unknown) {
  needArray(file, v, 'root', 1);
  const ids = new Set<number>();
  (v as unknown[]).forEach((o, i) => {
    need(file, o, ['id', 'name'], `[${i}]`);
    needInt(file, o.id, `[${i}].id`, 1);
    needString(file, o.name, `[${i}].name`);
    if (ids.has(o.id)) throw new DataShapeError(file, `[${i}].id ${o.id} appears twice`);
    ids.add(o.id);
  });
}

export function validateReconciliation(file: string, v: unknown) {
  need(file, v, ['policy', 'categories', 'assertions', 'passed', 'failed']);
  needArray(file, v.assertions, 'assertions', 1);
  needArray(file, v.categories, 'categories', 1);
  needNumber(file, v.passed, 'passed');
  needNumber(file, v.failed, 'failed');
}

/**
 * Cross-file references, checked once every file is in memory: every party id on a
 * project exists in its party file, every party's project exists in the register, every
 * engineer slug and vertical index is on the roster. A dangling id is a shape error here,
 * not a blank cell on a page.
 */
export function validateReferences(input: { projects: { ref: string; owners: number[]; leadConsultants: number[]; mepConsultant: number | null; mainContractors: number[]; mepContractor: number | null; ownerEngineer: string | null; ownerVertical: number | null }[]; consultants: { id: number; projects: string[]; owner: string | null }[]; contractors: { id: number; projects: string[]; owner: string | null }[]; owners: { id: number }[]; engineers: { slug: string; vertical: string }[]; verticals: { slug: string }[] }) {
  const cons = new Set(input.consultants.map((c) => c.id));
  const kons = new Set(input.contractors.map((c) => c.id));
  const own = new Set(input.owners.map((o) => o.id));
  const eng = new Map(input.engineers.map((e) => [e.slug, e.vertical]));
  const refs = new Set(input.projects.map((p) => p.ref));
  for (const p of input.projects) {
    for (const id of p.leadConsultants) if (!cons.has(id)) throw new DataShapeError('data/projects', `${p.ref} names consultant #${id}, which is not in parties/consultants.json`);
    if (p.mepConsultant !== null && !cons.has(p.mepConsultant)) throw new DataShapeError('data/projects', `${p.ref} names MEP consultant #${p.mepConsultant}, which is not in parties/consultants.json`);
    for (const id of p.mainContractors) if (!kons.has(id)) throw new DataShapeError('data/projects', `${p.ref} names contractor #${id}, which is not in parties/contractors.json`);
    if (p.mepContractor !== null && !kons.has(p.mepContractor)) throw new DataShapeError('data/projects', `${p.ref} names MEP contractor #${p.mepContractor}, which is not in parties/contractors.json`);
    for (const id of p.owners) if (!own.has(id)) throw new DataShapeError('data/projects', `${p.ref} names developer #${id}, which is not in parties/owners.json`);
    if (p.ownerEngineer !== null) {
      const vertical = eng.get(p.ownerEngineer);
      if (vertical === undefined) throw new DataShapeError('data/projects', `${p.ref} is owned by "${p.ownerEngineer}", who is not on the roster`);
      if (p.ownerVertical === null || input.verticals[p.ownerVertical]?.slug !== vertical) throw new DataShapeError('data/projects', `${p.ref} owner vertical does not match ${p.ownerEngineer}'s vertical`);
    }
  }
  for (const [file, list] of [['parties/consultants.json', input.consultants], ['parties/contractors.json', input.contractors]] as const) {
    for (const c of list) {
      for (const r of c.projects) if (!refs.has(r)) throw new DataShapeError(`data/${file}`, `firm #${c.id} lists project ${r}, which is not in the register`);
      if (c.owner !== null && !eng.has(c.owner)) throw new DataShapeError(`data/${file}`, `firm #${c.id} is owned by "${c.owner}", who is not on the roster`);
    }
  }
}

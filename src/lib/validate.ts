/**
 * Shape validation at the data boundary. Valid JSON of the wrong shape must
 * produce a readable error, never a blank page. Structural checks only: keys,
 * arrays, numbers, vector lengths; not a full schema mirror.
 */
import { BUCKETS } from '../../data/schema';

export class DataShapeError extends Error {
  constructor(file: string, detail: string) {
    super(`${file} does not have the expected shape: ${detail}.`);
    this.name = 'DataShapeError';
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function need(file: string, o: unknown, keys: string[], path = ''): asserts o is Obj {
  if (!isObj(o)) throw new DataShapeError(file, `${path || 'root'} is not an object`);
  for (const key of keys) if (!(key in o)) throw new DataShapeError(file, `missing ${path ? path + '.' : ''}${key}`);
}
function needArray(file: string, v: unknown, path: string, min = 0): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new DataShapeError(file, `${path} is not an array`);
  if (v.length < min) throw new DataShapeError(file, `${path} has ${v.length} rows, expected at least ${min}`);
}
function needNumber(file: string, v: unknown, path: string) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new DataShapeError(file, `${path} is not a finite number`);
}

/** Keys that may legitimately be null. */
const NULLABLE = new Set(['completionPct', 'mepConsultant', 'mepContractor', 'overall', 'ownerVertical', 'ownerEngineer', 'door']);
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

export function validateRollup(file: string, v: unknown) {
  need(file, v, ['meta', 'verticals', 'engineers', 'matrix', 'matrixRows', 'shards', 'kpis', 'sectorStage', 'chase', 'verticalSummary', 'engineerSummary', 'funnel', 'funnelProjects', 'parties', 'definitions', 'precisionPolicy', 'assumptions', 'cascade', 'bucketRule', 'distributions']);
  need(file, v.meta, ['company', 'division', 'system', 'dataAsOf', 'dataAsOfLabel', 'fiscalYear', 'currency', 'unit', 'seed'], 'meta');
  needArray(file, v.verticals, 'verticals', 1);
  needArray(file, v.engineers, 'engineers', 1);
  needArray(file, v.matrix, 'matrix', 1);
  needArray(file, v.shards, 'shards', 1);
  need(file, v.kpis, ['projects', 'owned', 'ownedValue', 'openEnquiriesAndQuotes', 'ordersThisYear', 'unowned'], 'kpis');
  for (const k of ['projects', 'owned', 'ownedValue', 'openEnquiriesAndQuotes', 'ordersThisYear', 'unowned']) needNumber(file, (v.kpis as Obj)[k], `kpis.${k}`);
  needArray(file, v.funnel, 'funnel', BUCKETS.length);
  const V = (v.verticals as unknown[]).length;
  (v.matrix as unknown[]).forEach((r, i) => {
    need(file, r, ['sector', 'industry', 'type', 'cells'], `matrix[${i}]`);
    needArray(file, r.cells, `matrix[${i}].cells`, V);
  });
  needFiniteLeaves(file, v.kpis, 'kpis');
  needFiniteLeaves(file, v.verticalSummary, 'verticalSummary');
  needFiniteLeaves(file, v.engineerSummary, 'engineerSummary');
  needFiniteLeaves(file, v.sectorStage, 'sectorStage');
}

export function validateShard(file: string, v: unknown) {
  need(file, v, ['sector', 'projects']);
  needArray(file, v.projects, 'projects', 1);
  (v.projects as unknown[]).forEach((p, i) => {
    need(file, p, ['ref', 'name', 'stage', 'completionPct', 'completionDate', 'value', 'city', 'sector', 'category', 'industry', 'type', 'attributes', 'owners', 'leadConsultants', 'mepConsultant', 'mainContractors', 'mepContractor', 'description', 'lastUpdated', 'scores', 'adjusted', 'overall', 'ownerVertical', 'ownerEngineer', 'why', 'buckets', 'bucketDates'], `projects[${i}]`);
    needNumber(file, p.value, `projects[${i}].value`);
    needArray(file, p.scores, `projects[${i}].scores`, 1);
    needArray(file, p.buckets, `projects[${i}].buckets`, 1);
    if ((p.scores as unknown[]).length !== (p.buckets as unknown[]).length) throw new DataShapeError(file, `projects[${i}] scores and buckets differ in length`);
    if (i < 3) needFiniteLeaves(file, p, `projects[${i}]`);
  });
}

export function validateParties(file: string, v: unknown) {
  needArray(file, v, 'root', 1);
  (v as unknown[]).forEach((p, i) => {
    need(file, p, ['id', 'name', 'kind', 'role', 'verticals', 'level', 'rating', 'owner', 'projectCount', 'projectValue', 'projects'], `[${i}]`);
    needNumber(file, p.projectValue, `[${i}].projectValue`);
    needNumber(file, p.rating, `[${i}].rating`);
  });
}

export function validateOwners(file: string, v: unknown) {
  needArray(file, v, 'root', 1);
  (v as unknown[]).forEach((o, i) => need(file, o, ['id', 'name'], `[${i}]`));
}

export function validateReconciliation(file: string, v: unknown) {
  need(file, v, ['policy', 'categories', 'assertions', 'passed', 'failed']);
  needArray(file, v.assertions, 'assertions', 1);
  needArray(file, v.categories, 'categories', 1);
  needNumber(file, v.passed, 'passed');
  needNumber(file, v.failed, 'failed');
}

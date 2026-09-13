/**
 * Cross-table reconciliation of the WRITTEN data files.
 *
 * Run:  bun scripts/reconcile.ts
 * Out:  public/data/reconciliation.json, exit 1 if any assertion fails.
 *
 * The generator asserts its own arithmetic in memory; this script re-reads the JSON the
 * browser will read and checks that every independently published figure ties to every
 * other one, and that every derived figure follows the stated rule in data/rules.ts:
 * every rollup equals the sum of its rows, every owner reproduces the cascade, every score
 * reproduces the matrix lookup, every party's count and value equal the register, the
 * funnel sums to the register, and no published number is outside its declared precision.
 * The result is shown on the Data basis page. No timestamp is written, so a re-run is byte-stable.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADE_SCORE, bestBucket, cascade, pickEngineer, stageGate, sum1, worthChasing } from '../data/rules';
import type { Assertion, Owner, Party, Project, Reconciliation, Rollup, Sector } from '../data/schema';
import { BUCKETS, SECTORS, STAGES } from '../data/schema';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'public', 'data');
const read = <T,>(rel: string): T => JSON.parse(readFileSync(join(dataDir, rel), 'utf8')) as T;
const raw = (rel: string) => readFileSync(join(dataDir, rel), 'utf8');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const tenths = (n: number) => Math.round(n * 10);

const rollup = read<Rollup>('rollup.json');
const shardFiles = rollup.shards.map((s) => ({ shard: s, body: read<{ sector: Sector; projects: Project[] }>(s.file) }));
const projects = shardFiles.flatMap((s) => s.body.projects).sort((a, b) => a.ref.localeCompare(b.ref));
const consultants = read<Party[]>('parties/consultants.json');
const contractors = read<Party[]>('parties/contractors.json');
const owners = read<Owner[]>('parties/owners.json');
const V = rollup.verticals.length;

const assertions: Assertion[] = [];
const eq = (category: string, id: string, statement: string, left: number, right: number) => assertions.push({ id, category, statement, left, right, pass: tenths(left) === tenths(right) });
const ok = (category: string, id: string, statement: string, pass: boolean, left = 1, right = pass ? 1 : 0) => assertions.push({ id, category, statement, left, right, pass });
const oneDecimal = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-6;
const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/* ---------- 1. shards and the register ---------- */
const C1 = 'Shards and register';
eq(C1, 'shard-count-total', 'Shard counts sum to the projects figure', sum(rollup.shards.map((s) => s.count)), rollup.kpis.projects);
eq(C1, 'register-count', 'Projects read from the shards equal the projects figure', projects.length, rollup.kpis.projects);
ok(C1, 'register-unique-refs', 'Every project reference is unique', new Set(projects.map((p) => p.ref)).size === projects.length, new Set(projects.map((p) => p.ref)).size, projects.length);
for (const { shard, body } of shardFiles) {
  eq(C1, `shard-${shard.file}-count`, `${shard.file} holds the count its index entry states`, body.projects.length, shard.count);
  eq(C1, `shard-${shard.file}-value`, `${shard.file} project values sum to its index entry`, sum1(body.projects.map((p) => p.value)), shard.value);
  ok(C1, `shard-${shard.file}-sector`, `${shard.file} carries only ${shard.sector} projects`, body.projects.every((p) => p.sector === shard.sector && body.sector === shard.sector));
}

/* ---------- 2. precision and shape ---------- */
const C2 = 'Precision policy';
for (const { shard, body } of shardFiles) {
  ok(C2, `precision-${shard.file}-values`, `${shard.file}: every value is AED million to one decimal`, body.projects.every((p) => oneDecimal(p.value) && p.value > 0));
  ok(C2, `precision-${shard.file}-scores`, `${shard.file}: every score is null or 0.0 to 8.0 to one decimal`, body.projects.every((p) => p.scores.length === V && p.scores.every((s) => s === null || (oneDecimal(s) && s >= 0 && s <= 8))));
  ok(C2, `precision-${shard.file}-completion`, `${shard.file}: completion is one decimal 0.0 to 100.0 under construction, null elsewhere`, body.projects.every((p) => (p.stage === 'Under Construction' ? p.completionPct !== null && oneDecimal(p.completionPct) && p.completionPct >= 0 && p.completionPct <= 100 : p.completionPct === null)));
  ok(C2, `precision-${shard.file}-dates`, `${shard.file}: every date is a calendar date`, body.projects.every((p) => isoDate(p.completionDate) && isoDate(p.lastUpdated) && p.bucketDates.length === V && p.bucketDates.every(isoDate)));
  ok(C2, `precision-${shard.file}-buckets`, `${shard.file}: every bucket code is one of the ${BUCKETS.length}`, body.projects.every((p) => p.buckets.length === V && p.buckets.every((b) => Number.isInteger(b) && b >= 0 && b < BUCKETS.length)));
}
ok(C2, 'precision-parties-values', 'Every party value is AED million to one decimal and every rating a whole number 1 to 10', [...consultants, ...contractors].every((p) => oneDecimal(p.projectValue) && Number.isInteger(p.rating) && p.rating >= 1 && p.rating <= 10));
ok(C2, 'precision-no-timestamps', 'No published file carries a generation timestamp', !['rollup.json', 'parties/consultants.json', ...rollup.shards.map((s) => s.file)].some((f) => /generatedAt|checkedAt|importedAt/.test(raw(f))));
ok(C2, 'precision-no-utc', 'No published file carries a UTC marker', !['rollup.json', 'parties/consultants.json', ...rollup.shards.map((s) => s.file)].some((f) => /\d{2}:\d{2}:\d{2}Z/.test(raw(f))));

/* ---------- 3. the matrix and every score ---------- */
const C3 = 'Relevance matrix';
const rowKey = (p: { sector: string; industry: string; type: string }) => `${p.sector}|${p.industry}|${p.type}`;
const rowIndex = new Map(rollup.matrix.map((r, i) => [rowKey(r), i]));
ok(C3, 'matrix-rows', `The matrix has ${rollup.matrix.length} rows, each with ${V} cells`, rollup.matrix.length >= 60 && rollup.matrix.every((r) => r.cells.length === V), rollup.matrix.length, rollup.matrix.length);
ok(C3, 'matrix-grade-scale', 'The published grade scale is High 8, Medium 5, Low 2', rollup.gradeScore.High === GRADE_SCORE.High && rollup.gradeScore.Medium === GRADE_SCORE.Medium && rollup.gradeScore.Low === GRADE_SCORE.Low);
rollup.matrix.forEach((r, i) => {
  const ps = projects.filter((p) => rowIndex.get(rowKey(p)) === i);
  eq(C3, `matrix-row-${i}-count`, `${r.sector} / ${r.industry} / ${r.type}: project count equals the row rollup`, ps.length, rollup.matrixRows[i]!.count);
  eq(C3, `matrix-row-${i}-value`, `${r.sector} / ${r.industry} / ${r.type}: project value equals the row rollup`, sum1(ps.map((p) => p.value)), rollup.matrixRows[i]!.value);
  const lookup = ps.every((p) => p.scores.every((s, vi) => (p.adjusted.includes(vi) ? s !== null : s === (r.cells[vi] ? GRADE_SCORE[r.cells[vi]!] : null))));
  ok(C3, `matrix-row-${i}-lookup`, `${r.type} (${r.industry}): every unadjusted score reproduces the matrix lookup for ${ps.length} projects`, lookup, ps.length, lookup ? ps.length : 0);
});
ok(C3, 'matrix-unknown-rows', 'Every project sits on a matrix row', projects.every((p) => rowIndex.has(rowKey(p))));
ok(C3, 'matrix-overall', 'Every overall score is the highest of its ten', projects.every((p) => {
  const g = p.scores.filter((s): s is number => s !== null);
  return g.length ? p.overall === Math.max(...g) : p.overall === null;
}));
eq(C3, 'matrix-rows-total', 'Matrix row counts sum to the register', sum(rollup.matrixRows.map((m) => m.count)), projects.length);

/* ---------- 4. the cascade, replayed in reference order ---------- */
const C4 = 'Ownership cascade';
const channels = rollup.verticals.map((v) => v.channel);
const assignedSoFar = rollup.verticals.map(() => 0);
const pipeline = new Map<string, number>(rollup.engineers.map((e) => [e.slug, 0]));
const roster = (vi: number) => rollup.engineers.filter((e) => e.vertical === rollup.verticals[vi]!.slug);
const mismatches = new Map<string, number>();
const groups = new Map<string, number>();
for (const p of projects) {
  const appointed = p.mainContractors.length > 0 || p.mepContractor !== null;
  const res = cascade({ stage: p.stage, completionPct: p.completionPct, contractorAppointed: appointed, scores: p.scores, channels, assignedSoFar });
  let engineer: string | null = null;
  if (res.vertical !== null) {
    const e = pickEngineer(roster(res.vertical), pipeline);
    engineer = e.slug;
    pipeline.set(e.slug, sum1([pipeline.get(e.slug) ?? 0, p.value]));
    assignedSoFar[res.vertical]!++;
  }
  const same = res.vertical === p.ownerVertical && engineer === p.ownerEngineer && res.why.gate === p.why.gate && res.why.tie === p.why.tie && res.why.eligible.join() === p.why.eligible.join() && res.why.candidates.join() === p.why.candidates.join();
  const key = `${p.sector}|${p.stage}`;
  groups.set(key, (groups.get(key) ?? 0) + 1);
  if (!same) mismatches.set(key, (mismatches.get(key) ?? 0) + 1);
}
for (const sector of SECTORS)
  for (const stage of STAGES) {
    const key = `${sector}|${stage}`;
    const n = groups.get(key) ?? 0;
    const bad = mismatches.get(key) ?? 0;
    ok(C4, `cascade-${key}`, `${sector}, ${stage}: every one of ${n} projects reproduces the cascade (owner vertical, engineer, gate and why)`, bad === 0, n, n - bad);
  }
ok(C4, 'cascade-gate-words', 'Every project with a candidate has an owner and every project without one has none', projects.every((p) => (p.why.candidates.length > 0) === (p.ownerVertical !== null)));
ok(C4, 'cascade-engineer-on-vertical', 'Every owning engineer is on the owning vertical', projects.every((p) => p.ownerEngineer === null || rollup.engineers.find((e) => e.slug === p.ownerEngineer)?.vertical === rollup.verticals[p.ownerVertical!]!.slug));
ok(C4, 'cascade-floor', `Every owning vertical scores at or above the scope floor of ${rollup.scopeFloor.toFixed(1)}`, projects.every((p) => p.ownerVertical === null || (p.scores[p.ownerVertical] ?? 0) >= rollup.scopeFloor));
ok(C4, 'cascade-gate', 'Every published gate reproduces the stage-gate rule', projects.every((p) => p.why.gate === 'none' || p.why.gate === stageGate(p.stage, p.completionPct, p.mainContractors.length > 0 || p.mepContractor !== null)));

/* ---------- 5. engineers ---------- */
const C5 = 'Engineers';
const vIndex = new Map(rollup.verticals.map((v, i) => [v.slug, i]));
for (const e of rollup.engineerSummary) {
  const owned = projects.filter((p) => p.ownerEngineer === e.slug);
  const vi = vIndex.get(e.vertical)!;
  eq(C5, `eng-${e.slug}-owned`, `${e.name}: owned count equals the register`, owned.length, e.owned);
  eq(C5, `eng-${e.slug}-value`, `${e.name}: pipeline value equals the sum of owned project values`, sum1(owned.map((p) => p.value)), e.ownedValue);
  eq(C5, `eng-${e.slug}-funnel-sum`, `${e.name}: funnel sums to owned count`, sum(e.funnel), e.owned);
  BUCKETS.forEach((b, code) => eq(C5, `eng-${e.slug}-funnel-${code}`, `${e.name}: ${b} equals the register`, owned.filter((p) => p.buckets[vi] === code).length, e.funnel[code]!));
  const top = [...owned].sort((a, b) => b.value - a.value || a.ref.localeCompare(b.ref)).slice(0, 5);
  ok(C5, `eng-${e.slug}-top`, `${e.name}: top five projects are the five largest owned`, top.map((p) => p.ref).join() === e.top.map((t) => t.ref).join() && e.top.every((t, i) => tenths(t.value) === tenths(top[i]!.value)));
  const cons = new Set([...owned.flatMap((p) => [...p.leadConsultants, ...(p.mepConsultant ? [p.mepConsultant] : [])]), ...consultants.filter((c) => c.owner === e.slug).map((c) => c.id)]);
  const cont = new Set([...owned.flatMap((p) => [...p.mainContractors, ...(p.mepContractor ? [p.mepContractor] : [])]), ...contractors.filter((c) => c.owner === e.slug).map((c) => c.id)]);
  eq(C5, `eng-${e.slug}-consultants`, `${e.name}: consultant relationships equal the distinct consultants on owned projects plus those owned`, cons.size, e.consultants);
  eq(C5, `eng-${e.slug}-contractors`, `${e.name}: contractor relationships equal the distinct contractors on owned projects plus those owned`, cont.size, e.contractors);
}
eq(C5, 'eng-total-owned', 'Engineer owned counts sum to the owned figure', sum(rollup.engineerSummary.map((e) => e.owned)), rollup.kpis.owned);
eq(C5, 'eng-total-value', 'Engineer pipeline values sum to the pipeline value owned', sum1(rollup.engineerSummary.map((e) => e.ownedValue)), rollup.kpis.ownedValue);
ok(C5, 'eng-roster', 'The 24 engineers each sit on one of the ten verticals', rollup.engineers.length === 24 && rollup.engineers.every((e) => vIndex.has(e.vertical)), rollup.engineers.length, 24);

/* ---------- 6. verticals ---------- */
const C6 = 'Verticals';
rollup.verticalSummary.forEach((v, vi) => {
  const owned = projects.filter((p) => p.ownerVertical === vi);
  eq(C6, `vert-${v.slug}-owned`, `${v.name}: owned count equals the register`, owned.length, v.owned);
  eq(C6, `vert-${v.slug}-value`, `${v.name}: owned value equals the sum of owned project values`, sum1(owned.map((p) => p.value)), v.ownedValue);
  eq(C6, `vert-${v.slug}-engineers`, `${v.name}: engineer count equals the roster`, roster(vi).length, v.engineers);
  eq(C6, `vert-${v.slug}-owned-eng`, `${v.name}: owned count equals the sum of its engineers' books`, sum(rollup.engineerSummary.filter((e) => e.vertical === v.slug).map((e) => e.owned)), v.owned);
  eq(C6, `vert-${v.slug}-funnel-sum`, `${v.name}: funnel sums to the register`, sum(v.funnel), projects.length);
  BUCKETS.forEach((b, code) => eq(C6, `vert-${v.slug}-funnel-${code}`, `${v.name}: ${b} equals the register`, projects.filter((p) => p.buckets[vi] === code).length, v.funnel[code]!));
});
eq(C6, 'vert-total-owned', 'Vertical owned counts sum to the owned figure', sum(rollup.verticalSummary.map((v) => v.owned)), rollup.kpis.owned);

/* ---------- 7. the headline figures ---------- */
const C7 = 'Headline figures';
const owned = projects.filter((p) => p.ownerVertical !== null);
const pairs = projects.flatMap((p) => p.buckets.map((b, i) => ({ b, date: p.bucketDates[i]! })));
eq(C7, 'kpi-projects', 'Projects in the register', projects.length, rollup.kpis.projects);
eq(C7, 'kpi-owned', 'Projects owned', owned.length, rollup.kpis.owned);
eq(C7, 'kpi-unowned', 'Projects with no owner', projects.length - owned.length, rollup.kpis.unowned);
eq(C7, 'kpi-owned-plus-unowned', 'Owned plus unowned equals the register', rollup.kpis.owned + rollup.kpis.unowned, rollup.kpis.projects);
eq(C7, 'kpi-owned-value', 'Pipeline value owned equals the sum of owned project values', sum1(owned.map((p) => p.value)), rollup.kpis.ownedValue);
eq(C7, 'kpi-open', 'Open enquiries and quotes equal the pairs in those two buckets', pairs.filter((x) => x.b === 1 || x.b === 2).length, rollup.kpis.openEnquiriesAndQuotes);
eq(C7, 'kpi-orders', `Orders received this year equal the Order received pairs dated ${rollup.meta.fiscalYear}`, pairs.filter((x) => x.b === 0 && x.date.startsWith(String(rollup.meta.fiscalYear))).length, rollup.kpis.ordersThisYear);

/* ---------- 8. sector by stage ---------- */
const C8 = 'Sector by stage';
for (const c of rollup.sectorStage) {
  const ps = projects.filter((p) => p.sector === c.sector && p.stage === c.stage);
  eq(C8, `ss-${c.sector}-${c.stage}-count`, `${c.sector}, ${c.stage}: count equals the register`, ps.length, c.count);
  eq(C8, `ss-${c.sector}-${c.stage}-value`, `${c.sector}, ${c.stage}: value equals the sum of project values`, sum1(ps.map((p) => p.value)), c.value);
}
eq(C8, 'ss-total-count', 'Sector-by-stage counts sum to the register', sum(rollup.sectorStage.map((c) => c.count)), projects.length);
eq(C8, 'ss-total-value', 'Sector-by-stage values sum to the register value', sum1(rollup.sectorStage.map((c) => c.value)), sum1(projects.map((p) => p.value)));
for (const d of rollup.distributions.sectors) eq(C8, `dist-sector-${d.sector}`, `${d.sector}: distribution count equals the register`, projects.filter((p) => p.sector === d.sector).length, d.count);
for (const d of rollup.distributions.stages) eq(C8, `dist-stage-${d.stage}`, `${d.stage}: distribution count equals the register`, projects.filter((p) => p.stage === d.stage).length, d.count);
for (const d of rollup.distributions.cities) eq(C8, `dist-city-${d.city}`, `${d.city}: distribution count equals the register`, projects.filter((p) => p.city === d.city).length, d.count);

/* ---------- 9. the funnel ---------- */
const C9 = 'Activity funnel';
BUCKETS.forEach((b, code) => {
  eq(C9, `funnel-${code}`, `${b}: pair count equals the register`, pairs.filter((x) => x.b === code).length, rollup.funnel[code]!);
  eq(C9, `funnel-projects-${code}`, `${b}: project count by best bucket equals the register`, projects.filter((p) => bestBucket(p.buckets) === code).length, rollup.funnelProjects[code]!);
});
eq(C9, 'funnel-sum', `The funnel sums to the register times ${V} verticals`, sum(rollup.funnel), projects.length * V);
eq(C9, 'funnel-projects-sum', 'The project funnel sums to the register', sum(rollup.funnelProjects), projects.length);
eq(C9, 'funnel-vertical-sum', 'Vertical funnels sum to the funnel, bucket by bucket', sum(BUCKETS.map((_, code) => Math.abs(sum(rollup.verticalSummary.map((v) => v.funnel[code]!)) - rollup.funnel[code]!))), 0);

/* ---------- 10. worth chasing ---------- */
const C10 = 'Worth chasing';
const chaseExpected = projects
  .filter((p) => worthChasing(p.stage, p.completionPct, p.overall, p.buckets))
  .sort((a, b) => b.value - a.value || a.ref.localeCompare(b.ref))
  .slice(0, 20);
ok(C10, 'chase-list', 'The worth-chasing list is the top twenty by value among projects that pass the rule', chaseExpected.map((p) => p.ref).join() === rollup.chase.map((c) => c.ref).join(), chaseExpected.length, rollup.chase.length);
ok(C10, 'chase-desc', 'The worth-chasing list is in descending value order', rollup.chase.every((c, i) => i === 0 || rollup.chase[i - 1]!.value >= c.value));
const consultantById = new Map(consultants.map((c) => [c.id, c]));
const contractorById = new Map(contractors.map((c) => [c.id, c]));
for (const c of rollup.chase) {
  const p = projects.find((x) => x.ref === c.ref)!;
  const gate = stageGate(p.stage, p.completionPct, p.mainContractors.length > 0 || p.mepContractor !== null);
  let door: { kind: string; id: number } | null = null;
  if (gate === 'specification') door = p.mepConsultant ? { kind: 'consultant', id: p.mepConsultant } : p.leadConsultants[0] ? { kind: 'consultant', id: p.leadConsultants[0] } : null;
  else door = p.mainContractors[0] ? { kind: 'contractor', id: p.mainContractors[0] } : p.mepContractor ? { kind: 'contractor', id: p.mepContractor } : p.leadConsultants[0] ? { kind: 'consultant', id: p.leadConsultants[0] } : null;
  const named = c.door ? (c.door.kind === 'consultant' ? consultantById.get(c.door.id)?.name : contractorById.get(c.door.id)?.name) : null;
  ok(C10, `chase-${c.ref}`, `${c.ref}: value, owner and door reproduce the register and the door rule`, tenths(c.value) === tenths(p.value) && c.ownerEngineer === p.ownerEngineer && c.ownerVertical === p.ownerVertical && JSON.stringify(door) === JSON.stringify(c.door ? { kind: c.door.kind, id: c.door.id } : null) && (c.door ? named === c.door.name : true));
}

/* ---------- 11. parties ---------- */
const C11 = 'Consultants and contractors';
const byRef = new Map(projects.map((p) => [p.ref, p]));
function partyCheck(kind: 'consultant' | 'contractor', list: Party[]) {
  const links = new Map<number, Set<string>>();
  for (const p of projects) {
    const ids = kind === 'consultant' ? [...p.leadConsultants, ...(p.mepConsultant ? [p.mepConsultant] : [])] : [...p.mainContractors, ...(p.mepContractor ? [p.mepContractor] : [])];
    for (const id of ids) (links.get(id) ?? links.set(id, new Set()).get(id)!).add(p.ref);
  }
  eq(C11, `${kind}s-count`, `${kind}s on at least one project equal the party file`, links.size, list.length);
  eq(C11, `${kind}s-rollup`, `${kind} count equals the rollup figure`, list.length, rollup.parties[`${kind}s`]);
  for (const party of list) {
    const refs = [...(links.get(party.id) ?? [])].sort();
    const value = sum1(refs.map((r) => byRef.get(r)!.value));
    const same = refs.join() === party.projects.join() && refs.length === party.projectCount;
    ok(C11, `${kind}-${party.id}`, `${party.name}: ${party.projectCount} projects and AED ${party.projectValue.toFixed(1)} m equal the register`, same && tenths(value) === tenths(party.projectValue), party.projectValue, value);
  }
  ok(C11, `${kind}s-owner`, `Every ${kind} relationship owner is an engineer`, list.every((p) => rollup.engineers.some((e) => e.slug === p.owner)));
  ok(C11, `${kind}s-verticals`, `Every ${kind}'s verticals are the ones graded Medium or High on its projects, by count`, list.every((party) => {
    const counts = rollup.verticals.map(() => 0);
    for (const r of party.projects) byRef.get(r)!.scores.forEach((s, i) => (s !== null && s >= 3.5 ? counts[i]!++ : 0));
    const expected = counts.map((c, i) => ({ c, i })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c || a.i - b.i).slice(0, 4).map((x) => x.i);
    return expected.join() === party.verticals.join();
  }));
}
partyCheck('consultant', consultants);
partyCheck('contractor', contractors);
ok(C11, 'consultant-roles', 'Lead links go to Lead/Design or both; MEP links go to MEP or both', projects.every((p) => p.leadConsultants.every((id) => consultantById.get(id)!.role !== 'mep') && (p.mepConsultant === null || consultantById.get(p.mepConsultant)!.role !== 'lead')));
ok(C11, 'contractor-roles', 'Main links go to Main/EPC or both; MEP links go to MEP or both', projects.every((p) => p.mainContractors.every((id) => contractorById.get(id)!.role !== 'mep') && (p.mepContractor === null || contractorById.get(p.mepContractor)!.role !== 'lead')));
const ownerIds = new Set(owners.map((o) => o.id));
ok(C11, 'owners-known', 'Every project owner id is in the owners file', projects.every((p) => p.owners.every((id) => ownerIds.has(id))));
eq(C11, 'owners-rollup', 'Owner count equals the rollup figure', owners.length, rollup.parties.owners);

/* ---------- write ---------- */
const categories = [...new Set(assertions.map((a) => a.category))].map((name) => ({ name, checked: assertions.filter((a) => a.category === name).length, passed: assertions.filter((a) => a.category === name && a.pass).length }));
const out: Reconciliation = {
  policy: rollup.precisionPolicy,
  categories,
  assertions,
  passed: assertions.filter((a) => a.pass).length,
  failed: assertions.filter((a) => !a.pass).length,
};
writeFileSync(join(dataDir, 'reconciliation.json'), JSON.stringify(out, null, 1) + '\n');
for (const a of assertions) if (!a.pass) console.error(`FAIL ${a.id}: ${a.statement} (${a.left} vs ${a.right})`);
console.log(`${out.passed} of ${assertions.length} assertions pass across ${categories.length} categories${out.failed ? `, ${out.failed} FAILED` : ''}.`);
if (out.failed) process.exit(1);

/**
 * Deterministic BNC-backed data for the Halvard Project Intelligence System demo.
 *
 * Run:  bun scripts/generate_demo_data.ts
 * Out:  public/data/rollup.json, projects/<shard>.json, parties/{consultants,contractors,owners}.json
 *
 * Everything derives from one seed. Every rule the front end relies on (the grade scale,
 * the ownership cascade, the bucket priority, the precision policy) lives in data/rules.ts
 * and is applied here; scripts/reconcile.ts re-checks the written files independently.
 *
 * No published file carries a timestamp. The data-as-of date is the constant DATA_AS_OF
 * below, so a re-run writes byte-identical files and `git status` stays clean.
 *
 * Project, value, geography and company fields come from the three private BNC extracts.
 * The ten verticals, 24 engineers, relevance model, ownership, relationship ratings and
 * activity are an illustrative internal commercial layer for the closed demo.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANNELS } from '../data/channels';
import { ACTIVITY_BANDS, ENGINEER_CAPACITY, GRADE_SCORE, WORKLOAD_WEIGHTS, gradeOf, NOT_YET_AWARDED, NO_UPDATE, ORDER_RECEIVED, PROJECT_CLOSED, QUOTE_SENT, ENQUIRY_GENERATED, SCOPE_FLOOR, BUYING_COMPLETION_FLOOR_PCT, bestBucket, cascade, pctOf, pickEngineer, r1, sum1, worthChasing, workloadOf, stageGate } from '../data/rules';
import { SHAPE_TARGETS } from '../data/shape';
import type {
  Attribute,
  BucketCode,
  Category,
  Cell,
  ChaseRow,
  City,
  Definition,
  Engineer,
  EngineerSummary,
  MatrixRow,
  MatrixSummary,
  PartyKindSummary,
  PartyRank,
  PartySummary,
  VerticalReach,
  Meta,
  Owner,
  Party,
  PartyKind,
  PartyRole,
  Project,
  RelationshipLevel,
  Rollup,
  Sector,
  SectorStageCell,
  Shard,
  ShapeCheck,
  Stage,
  Vertical,
  VerticalSummary,
} from '../data/schema';
import { BUCKETS, CITIES, SECTORS, STAGES } from '../data/schema';

/* ---------- constants ---------- */

const SEED = 20260913;
const DATA_AS_OF = '2026-05-04';
const DATA_AS_OF_LABEL = '04 May 2026';
const FISCAL_YEAR = 2026;
const SHARD_MAX = 720;

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'data');

interface BncProject {
  ref: string;
  name: string;
  stage: Stage;
  completionPct: number | null;
  completionDate: string | null;
  value: number;
  city: City;
  sector: Sector;
  category: Category;
  industry: string;
  type: string;
  location: string;
  attributes: Attribute[];
  owners: string[];
  leadConsultants: string[];
  mepConsultants: string[];
  mainContractors: string[];
  mepContractors: string[];
  description: string;
  lastUpdated: string;
  source: 'urban_industrial' | 'other_sectors' | 'brownfield';
}
interface BncSource {
  metadata: {
    rawRows: number;
    uniqueProjects: number;
    overlapRows: number;
    sources: { key: string; file: string; snapshot: string; rows: number; sha256: string }[];
    privacy: string;
  };
  projects: BncProject[];
}
const bnc = JSON.parse(readFileSync(join(here, '..', '.private', 'bnc-source.json'), 'utf8')) as BncSource;
const TARGET_PROJECTS = bnc.projects.length;

/* ---------- deterministic randomness ---------- */

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(SEED);
const between = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
/** Weighted pick; weights need not sum to one. */
function weighted<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}
/** Standard normal by Box-Muller. */
function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rnd();
  while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/* ---------- dates: calendar arithmetic on date-only values, UTC fields as the reader ---------- */

const dayMs = 86400000;
const toT = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
};
const fromT = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
};
const addDays = (iso: string, days: number) => fromT(toT(iso) + days * dayMs);

/* ---------- invented names ---------- */

const forbidden = new Set(
  readFileSync(join(here, 'forbidden_terms.txt'), 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.trim().toLowerCase()),
);
const ONSETS = ['k', 't', 'v', 'm', 'r', 'n', 's', 'l', 'd', 'b', 'z', 'h', 'f', 'j', 'th', 'sh', 'br', 'tr', 'kr', 'dr', 'pr', 'vl', 'q'];
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'ai', 'ou', 'ee', 'aa'];
const CODAS = ['', '', '', 'n', 'r', 'l', 's', 'm', 'd', 'th', 'sh'];
const usedWords = new Set<string>();
/** An invented word of two or three syllables, capitalised, unique, and never a forbidden term. */
function word(): string {
  for (;;) {
    const n = rnd() < 0.55 ? 2 : 3;
    let w = '';
    for (let i = 0; i < n; i++) w += pick(ONSETS) + pick(NUCLEI) + (i === n - 1 ? pick(CODAS) : rnd() < 0.3 ? pick(CODAS) : '');
    w = w[0]!.toUpperCase() + w.slice(1);
    if (w.length < 4 || w.length > 10) continue;
    const key = w.toLowerCase();
    if (usedWords.has(key) || forbidden.has(key)) continue;
    usedWords.add(key);
    return w;
  }
}
const usedNames = new Set<string>();
function unique(make: () => string): string {
  for (;;) {
    const n = make();
    if (usedNames.has(n.toLowerCase())) continue;
    usedNames.add(n.toLowerCase());
    return n;
  }
}

/* ---------- roster ---------- */

const verticalsFile = JSON.parse(readFileSync(join(here, '..', 'data', 'verticals.json'), 'utf8')) as { verticals: { slug: string; name: string }[] };
const engineersFile = JSON.parse(readFileSync(join(here, '..', 'data', 'engineers.json'), 'utf8')) as { engineers: Engineer[] };
const verticals: Vertical[] = verticalsFile.verticals.map((v) => {
  const channel = CHANNELS[v.slug];
  if (!channel) throw new Error(`no channel for vertical ${v.slug}`);
  return { slug: v.slug, name: v.name, channel };
});
const V = verticals.length;
const vIndex = new Map(verticals.map((v, i) => [v.slug, i]));
const engineers: Engineer[] = engineersFile.engineers;
if (V !== 10 || engineers.length !== 24) throw new Error(`expected 10 verticals and 24 engineers, got ${V} and ${engineers.length}`);
for (const e of engineers) if (!vIndex.has(e.vertical)) throw new Error(`engineer ${e.slug} on unknown vertical ${e.vertical}`);
const roster = (vi: number) => engineers.filter((e) => e.vertical === verticals[vi]!.slug);

/* ---------- the relevance matrix: one grade per (row, vertical), by rule ---------- */

type GradeLists = { High: string[]; Medium: string[]; Low: string[] };
const AFFINITY: Record<string, GradeLists> = {
  automation: {
    High: ['Airport', 'Data Center', 'Factory / Plant / Farm', 'Refinery', 'Hydrogen Plants', 'Nuclear Power Plant', 'Renewable Energy Plant', 'Desalination Plant', 'Water Treatment Plant', 'Waste to Energy Plant', 'Pumping Station', 'Metro Station', 'Railway', 'Tunnel', 'Mega Industrial Development', 'Hospital', 'Substation'],
    Medium: ['High Rise (15+)', 'Hotel', 'Shopping Mall', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Port & Harbor', 'Cold Store', 'Food Processing Plant', 'Stadium', 'Offshore Platform', 'Pipeline', 'Mega Urban Development', 'University / College', 'Hotel Apartments', 'Research Centre', 'Rail Depot', 'Air Cargo Terminal'],
    Low: ['Mid Rise (4 - 14)', 'Low Rise (1 -3)', 'School', 'Clinic', 'Showroom', 'Service Centre', 'Resort', 'Park', 'Sports Club & Facilities', 'Landmark, Museum & Galleries', 'Theme Park', 'Golf Course', 'Mosque', 'Library', 'Training Centre', 'Serviced Apartments', 'Medical / Research center', 'Light Industrial/Workshop', 'Hangar facility', 'Shipyard', 'Gas / Petrol Station', 'Dam / reservoir', 'Water Network', 'Sewerage / Drainage Network', 'Canal / Waterway'],
  },
  cooling: {
    High: ['High Rise (15+)', 'Hotel', 'Hospital', 'Data Center', 'Shopping Mall', 'Mega Urban Development', 'Airport', 'Hotel Apartments', 'Resort', 'University / College', 'Medical / Research center', 'Stadium', 'Cold Store', 'Food Processing Plant', 'Mid Rise (4 - 14)', 'Serviced Apartments', 'Metro Station'],
    Medium: ['Low Rise (1 -3)', 'School', 'Clinic', 'Showroom', 'Service Centre', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Theme Park', 'Library', 'Training Centre', 'Mosque', 'Research Centre', 'Factory / Plant / Farm', 'Light Industrial/Workshop', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Air Cargo Terminal', 'Hangar facility', 'Port & Harbor', 'Rail Depot', 'Mega Industrial Development', 'Refinery', 'Offshore Platform', 'Substation', 'Nuclear Power Plant', 'Desalination Plant'],
    Low: ['Park', 'Golf Course', 'Gas / Petrol Station', 'Pumping Station', 'Water Treatment Plant', 'Waste to Energy Plant', 'Renewable Energy Plant', 'Hydrogen Plants', 'Shipyard', 'Pipeline'],
  },
  'electrical-distribution': {
    High: ['High Rise (15+)', 'Mid Rise (4 - 14)', 'Hotel', 'Hospital', 'Data Center', 'Shopping Mall', 'Mega Urban Development', 'Mega Industrial Development', 'Airport', 'Factory / Plant / Farm', 'Refinery', 'Hydrogen Plants', 'Nuclear Power Plant', 'Renewable Energy Plant', 'Substation', 'Desalination Plant', 'Water Treatment Plant', 'Waste to Energy Plant', 'Metro Station', 'Railway', 'Tunnel', 'Port & Harbor', 'Pumping Station', 'University / College', 'Stadium', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Cold Store', 'Food Processing Plant', 'Offshore Platform', 'Rail Depot', 'Air Cargo Terminal', 'Research Centre'],
    Medium: ['Low Rise (1 -3)', 'School', 'Clinic', 'Medical / Research center', 'Showroom', 'Service Centre', 'Resort', 'Hotel Apartments', 'Serviced Apartments', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Theme Park', 'Library', 'Training Centre', 'Mosque', 'Light Industrial/Workshop', 'Hangar facility', 'Shipyard', 'Gas / Petrol Station', 'Pipeline', 'Dam / reservoir', 'Water Network', 'Sewerage / Drainage Network', 'Road', 'Bridge'],
    Low: ['Park', 'Golf Course', 'Canal / Waterway'],
  },
  fabrication: {
    High: ['Factory / Plant / Farm', 'Mega Industrial Development', 'Refinery', 'Hydrogen Plants', 'Offshore Platform', 'Pipeline', 'Shipyard', 'Port & Harbor', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Hangar facility', 'Air Cargo Terminal', 'Rail Depot', 'Substation', 'Desalination Plant', 'Water Treatment Plant', 'Waste to Energy Plant', 'Nuclear Power Plant', 'Renewable Energy Plant'],
    Medium: ['Airport', 'High Rise (15+)', 'Data Center', 'Hospital', 'Stadium', 'Shopping Mall', 'Mega Urban Development', 'Cold Store', 'Food Processing Plant', 'Light Industrial/Workshop', 'Metro Station', 'Railway', 'Tunnel', 'Bridge', 'Pumping Station', 'Dam / reservoir', 'Research Centre', 'Gas / Petrol Station', 'Landmark, Museum & Galleries'],
    Low: ['Mid Rise (4 - 14)', 'Hotel', 'Hotel Apartments', 'Serviced Apartments', 'Resort', 'University / College', 'School', 'Medical / Research center', 'Clinic', 'Showroom', 'Service Centre', 'Sports Club & Facilities', 'Theme Park', 'Mosque', 'Sewerage / Drainage Network', 'Water Network', 'Road', 'Canal / Waterway'],
  },
  'mechanical-systems': {
    High: ['Hospital', 'Hotel', 'High Rise (15+)', 'Data Center', 'Shopping Mall', 'Airport', 'Mega Urban Development', 'University / College', 'Medical / Research center', 'Stadium', 'Factory / Plant / Farm', 'Food Processing Plant', 'Refinery', 'Hydrogen Plants', 'Nuclear Power Plant', 'Desalination Plant', 'Water Treatment Plant', 'Waste to Energy Plant', 'Mega Industrial Development', 'Cold Store', 'Metro Station', 'Hotel Apartments', 'Resort'],
    Medium: ['Mid Rise (4 - 14)', 'Low Rise (1 -3)', 'School', 'Clinic', 'Showroom', 'Service Centre', 'Serviced Apartments', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Theme Park', 'Library', 'Training Centre', 'Mosque', 'Research Centre', 'Light Industrial/Workshop', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Air Cargo Terminal', 'Hangar facility', 'Port & Harbor', 'Rail Depot', 'Offshore Platform', 'Substation', 'Renewable Energy Plant', 'Pumping Station', 'Tunnel', 'Railway'],
    Low: ['Park', 'Golf Course', 'Gas / Petrol Station', 'Shipyard', 'Pipeline', 'Dam / reservoir', 'Water Network', 'Sewerage / Drainage Network'],
  },
  metering: {
    High: ['Mega Urban Development', 'High Rise (15+)', 'Mid Rise (4 - 14)', 'Hotel Apartments', 'Serviced Apartments', 'Water Network', 'Sewerage / Drainage Network', 'Pumping Station', 'Desalination Plant', 'Water Treatment Plant', 'Substation', 'Renewable Energy Plant', 'Mega Industrial Development', 'Data Center', 'Shopping Mall', 'University / College'],
    Medium: ['Low Rise (1 -3)', 'Hotel', 'Resort', 'Hospital', 'Medical / Research center', 'School', 'Clinic', 'Airport', 'Metro Station', 'Railway', 'Rail Depot', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Cold Store', 'Factory / Plant / Farm', 'Food Processing Plant', 'Light Industrial/Workshop', 'Stadium', 'Sports Club & Facilities', 'Theme Park', 'Landmark, Museum & Galleries', 'Research Centre', 'Dam / reservoir', 'Waste to Energy Plant', 'Nuclear Power Plant', 'Hydrogen Plants', 'Refinery', 'Port & Harbor', 'Air Cargo Terminal'],
    Low: ['Showroom', 'Service Centre', 'Library', 'Training Centre', 'Mosque', 'Park', 'Golf Course', 'Hangar facility', 'Shipyard', 'Gas / Petrol Station', 'Pipeline', 'Offshore Platform', 'Tunnel'],
  },
  'pumps-and-water': {
    High: ['Pumping Station', 'Water Network', 'Sewerage / Drainage Network', 'Desalination Plant', 'Water Treatment Plant', 'Dam / reservoir', 'Canal / Waterway', 'Waste to Energy Plant', 'Refinery', 'Hydrogen Plants', 'Factory / Plant / Farm', 'Food Processing Plant', 'Hospital', 'Hotel', 'High Rise (15+)', 'Mega Urban Development', 'Mega Industrial Development', 'Airport', 'Resort', 'Nuclear Power Plant', 'Tunnel', 'Port & Harbor', 'Golf Course', 'Park', 'Theme Park', 'Stadium'],
    Medium: ['Mid Rise (4 - 14)', 'Low Rise (1 -3)', 'Hotel Apartments', 'Serviced Apartments', 'University / College', 'School', 'Medical / Research center', 'Clinic', 'Shopping Mall', 'Data Center', 'Metro Station', 'Railway', 'Rail Depot', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Cold Store', 'Light Industrial/Workshop', 'Offshore Platform', 'Pipeline', 'Shipyard', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Mosque', 'Research Centre', 'Renewable Energy Plant', 'Substation', 'Air Cargo Terminal', 'Hangar facility', 'Road', 'Bridge'],
    Low: ['Showroom', 'Service Centre', 'Library', 'Training Centre', 'Gas / Petrol Station'],
  },
  services: {
    High: ['Hospital', 'Airport', 'Data Center', 'Shopping Mall', 'Hotel', 'Factory / Plant / Farm', 'Refinery', 'Nuclear Power Plant', 'Desalination Plant', 'Water Treatment Plant', 'Metro Station', 'Railway', 'Port & Harbor', 'Mega Urban Development', 'Mega Industrial Development', 'University / College', 'Stadium', 'Cold Store', 'Food Processing Plant'],
    Medium: ['High Rise (15+)', 'Mid Rise (4 - 14)', 'Hotel Apartments', 'Serviced Apartments', 'Resort', 'Medical / Research center', 'Clinic', 'School', 'Logistics Hub / Center', 'Warehouse / Tankages / Silos', 'Light Industrial/Workshop', 'Research Centre', 'Renewable Energy Plant', 'Substation', 'Waste to Energy Plant', 'Hydrogen Plants', 'Pumping Station', 'Offshore Platform', 'Air Cargo Terminal', 'Rail Depot', 'Hangar facility', 'Tunnel', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Theme Park'],
    Low: ['Low Rise (1 -3)', 'Showroom', 'Service Centre', 'Library', 'Training Centre', 'Mosque', 'Park', 'Golf Course', 'Gas / Petrol Station', 'Pipeline', 'Shipyard', 'Dam / reservoir', 'Water Network', 'Sewerage / Drainage Network', 'Bridge', 'Road', 'Canal / Waterway'],
  },
  trading: {
    High: ['Mid Rise (4 - 14)', 'Low Rise (1 -3)', 'Light Industrial/Workshop', 'Warehouse / Tankages / Silos', 'Logistics Hub / Center', 'Showroom', 'Service Centre', 'Gas / Petrol Station', 'School', 'Clinic', 'Serviced Apartments', 'Hotel Apartments', 'Mosque'],
    Medium: ['High Rise (15+)', 'Hotel', 'Resort', 'Hospital', 'Medical / Research center', 'University / College', 'Shopping Mall', 'Data Center', 'Factory / Plant / Farm', 'Food Processing Plant', 'Cold Store', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Theme Park', 'Library', 'Training Centre', 'Park', 'Golf Course', 'Research Centre', 'Hangar facility', 'Air Cargo Terminal', 'Rail Depot', 'Substation', 'Pumping Station'],
    Low: ['Mega Urban Development', 'Mega Industrial Development', 'Airport', 'Metro Station', 'Railway', 'Port & Harbor', 'Shipyard', 'Refinery', 'Hydrogen Plants', 'Nuclear Power Plant', 'Renewable Energy Plant', 'Desalination Plant', 'Water Treatment Plant', 'Waste to Energy Plant', 'Offshore Platform', 'Pipeline', 'Stadium', 'Tunnel', 'Dam / reservoir', 'Water Network', 'Sewerage / Drainage Network'],
  },
  'vertical-transport': {
    High: ['High Rise (15+)', 'Hotel', 'Hospital', 'Airport', 'Shopping Mall', 'Mega Urban Development', 'Hotel Apartments', 'Serviced Apartments', 'Metro Station', 'University / College', 'Medical / Research center', 'Stadium', 'Mid Rise (4 - 14)'],
    Medium: ['Resort', 'Low Rise (1 -3)', 'School', 'Clinic', 'Data Center', 'Showroom', 'Service Centre', 'Landmark, Museum & Galleries', 'Sports Club & Facilities', 'Theme Park', 'Library', 'Training Centre', 'Mosque', 'Research Centre', 'Air Cargo Terminal', 'Railway', 'Rail Depot', 'Port & Harbor', 'Logistics Hub / Center', 'Warehouse / Tankages / Silos', 'Factory / Plant / Farm', 'Mega Industrial Development', 'Substation', 'Nuclear Power Plant', 'Offshore Platform', 'Tunnel', 'Bridge'],
    Low: ['Light Industrial/Workshop', 'Cold Store', 'Food Processing Plant', 'Hangar facility', 'Shipyard', 'Refinery', 'Hydrogen Plants', 'Renewable Energy Plant', 'Desalination Plant', 'Water Treatment Plant', 'Waste to Energy Plant', 'Pumping Station', 'Park', 'Golf Course', 'Gas / Petrol Station'],
  },
};

function gradeFor(vslug: string, type: string): Cell {
  const a = AFFINITY[vslug];
  if (!a) throw new Error(`no affinity table for ${vslug}`);
  if (a.High.includes(type)) return 'High';
  if (a.Medium.includes(type)) return 'Medium';
  if (a.Low.includes(type)) return 'Low';
  return null;
}

const TYPE_ALIAS: Record<string, string> = {
  'Oil Terminal / Storage Tank / Tank Farm': 'Warehouse / Tankages / Silos',
  'Oil Field Development': 'Offshore Platform',
  'Gas Field Development': 'Offshore Platform',
  'Oil & Gas Pipeline': 'Pipeline',
  'Oil Refinery': 'Refinery',
  'Offsites & Utilities': 'Factory / Plant / Farm',
  'Natural Gas Processing / Treatment Unit': 'Refinery',
  'Petrochemical Plant': 'Refinery',
  'Central Processing facilities (CPF)': 'Factory / Plant / Farm',
  'Gas & Oil Separation Units (GOSP)': 'Factory / Plant / Farm',
  'Electricity / Power Network': 'Substation',
  'Gas Terminal': 'Warehouse / Tankages / Silos',
  'Fossil-Fuel Power Plants': 'Renewable Energy Plant',
  'Zoo and Animal Reserve': 'Park',
  'Theme Park & Water Park': 'Theme Park',
  Infrastructure: 'Mega Urban Development',
  'Water Distribution Network': 'Water Network',
  'Sewerage / Solid Waste Treatment Plant': 'Water Treatment Plant',
  'Water Desalination Plant': 'Desalination Plant',
  Terminal: 'Airport',
  Monorail: 'Railway',
  'Metro & Subway': 'Metro Station',
  Tram: 'Railway',
  'Runway & Ancilliary Facilities': 'Airport',
  'District Cooling Plant': 'Factory / Plant / Farm',
  'District Cooling Network': 'Water Network',
  'Telecommunications Network': 'Substation',
  'Biogas/Biofuel Plants': 'Hydrogen Plants',
  'Ammonia Plants': 'Hydrogen Plants',
  'Synthetic Fuel Plants': 'Hydrogen Plants',
  'Drilling & Exploration works': 'Offshore Platform',
  'Water Storage Tanks': 'Warehouse / Tankages / Silos',
  'Super Market': 'Shopping Mall',
  'Cinema / Theatre / Auditorium': 'Landmark, Museum & Galleries',
  'Natural Gas Distribution Network': 'Pipeline',
  'Other Religious Building': 'Mosque',
};
function affinityType(type: string, sector: Sector): string {
  if (TYPE_ALIAS[type]) return TYPE_ALIAS[type]!;
  if (Object.values(AFFINITY).some((grades) => grades.High.includes(type) || grades.Medium.includes(type) || grades.Low.includes(type))) return type;
  if (sector === 'Industrial') return 'Factory / Plant / Farm';
  if (sector === 'Oil, Gas and Fuels') return 'Refinery';
  if (sector === 'Transport') return 'Road';
  if (sector === 'Utilities') return 'Substation';
  return 'Low Rise (1 -3)';
}

const sourceRows = [...new Map(bnc.projects.map((p) => [`${p.sector}|${p.industry}|${p.type}`, p])).values()];
const matrix: MatrixRow[] = sourceRows.map((p) => ({
  sector: p.sector,
  industry: p.industry,
  type: p.type,
  cells: verticals.map((v) => gradeFor(v.slug, affinityType(p.type, p.sector))),
}));
const rowWeight = matrix.map(() => 1);
const rowIndex = new Map(matrix.map((r, i) => [`${r.sector}|${r.industry}|${r.type}`, i]));
/* the matrix must grade every type on at least one vertical, and give every vertical real reach */
for (const r of matrix) if (r.cells.every((c) => c === null)) throw new Error(`matrix row ${r.type} has no grade on any vertical`);
verticals.forEach((v, vi) => {
  const highs = matrix.filter((r) => r.cells[vi] === 'High').length;
  if (highs < 5) throw new Error(`vertical ${v.slug} is High on only ${highs} rows`);
});

/* ---------- parties ---------- */

interface PartyDraft {
  id: number;
  name: string;
  kind: PartyKind;
  role: PartyRole;
  /** Zipf weight for being picked. */
  w: number;
  projects: Set<string>;
}
function sourceParties(kind: PartyKind): PartyDraft[] {
  const roles = new Map<string, Set<'lead' | 'mep'>>();
  const add = (names: string[], role: 'lead' | 'mep') => names.forEach((name) => {
    if (!roles.has(name)) roles.set(name, new Set());
    roles.get(name)!.add(role);
  });
  for (const p of bnc.projects) {
    if (kind === 'consultant') {
      add(p.leadConsultants, 'lead');
      add(p.mepConsultants, 'mep');
    } else {
      add(p.mainContractors, 'lead');
      add(p.mepContractors, 'mep');
    }
  }
  return [...roles.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, set], i) => ({
    id: i + 1,
    name,
    kind,
    role: set.size === 2 ? 'both' : set.has('mep') ? 'mep' : 'lead',
    w: 1,
    projects: new Set<string>(),
  }));
}
const consultants = sourceParties('consultant');
const contractors = sourceParties('contractor');
const ownerNames = [...new Set(bnc.projects.flatMap((p) => p.owners))].sort((a, b) => a.localeCompare(b));
const owners: Owner[] = ownerNames.map((name, i) => ({ id: i + 1, name }));
const ownerW = owners.map((_, i) => 1 / Math.pow(i + 5, 0.9));

function drawParty(pool: PartyDraft[], accept: (r: PartyRole) => boolean, exclude: number[]): PartyDraft {
  const cands = pool.filter((p) => accept(p.role) && !exclude.includes(p.id));
  return weighted(
    cands,
    cands.map((c) => c.w),
  );
}

/* ---------- the register ---------- */

const STAGE_W: Record<Stage, number> = { Concept: 11, Design: 17, Tender: 12, 'Under Construction': 34, 'Completed (3 months)': 5, 'Completed (1 year)': 7, 'Completed (3 years)': 7, 'Completed (above 3 years)': 7 };
const CITY_W: Record<City, number> = { Dubai: 45, 'Abu Dhabi': 30, Sharjah: 8, Ajman: 4, 'Ras Al Khaimah': 5, Fujairah: 3, 'Al Ain': 3, 'Umm Al Quwain': 2 };
/** Value scale by type: multipliers on the register's log-normal, so a clinic and an airport are not the same size. */
const VALUE_MULT: Record<string, number> = {
  'Mega Urban Development': 12,
  'Mega Industrial Development': 8,
  Airport: 6,
  'Nuclear Power Plant': 30,
  Refinery: 10,
  'Hydrogen Plants': 6,
  'Port & Harbor': 5,
  Railway: 8,
  'Metro Station': 2,
  Tunnel: 4,
  'Offshore Platform': 6,
  'Desalination Plant': 5,
  'Water Treatment Plant': 2.5,
  'Waste to Energy Plant': 4,
  'Renewable Energy Plant': 3,
  'Dam / reservoir': 3,
  'High Rise (15+)': 2.2,
  'Shopping Mall': 2.5,
  Hospital: 2.4,
  Stadium: 3,
  'University / College': 1.8,
  Hotel: 1.8,
  Resort: 2.2,
  'Data Center': 2.5,
  'Theme Park': 4,
  Road: 1.6,
  Bridge: 1.2,
  Pipeline: 2,
  'Factory / Plant / Farm': 1.2,
  'Mid Rise (4 - 14)': 0.8,
  'Low Rise (1 -3)': 0.45,
  School: 0.4,
  Clinic: 0.25,
  Showroom: 0.2,
  'Service Centre': 0.25,
  'Gas / Petrol Station': 0.12,
  Mosque: 0.3,
  Library: 0.3,
  'Training Centre': 0.3,
  Park: 0.35,
  'Golf Course': 0.9,
  'Light Industrial/Workshop': 0.35,
  'Cold Store': 0.5,
  'Pumping Station': 0.4,
  Substation: 0.7,
  'Hangar facility': 0.6,
  'Rail Depot': 1.5,
  'Water Network': 1.2,
  'Sewerage / Drainage Network': 1.4,
  'Canal / Waterway': 2,
  'Hotel Apartments': 1.2,
  'Serviced Apartments': 1,
  'Medical / Research center': 1.4,
  'Sports Club & Facilities': 0.8,
  'Landmark, Museum & Galleries': 1.5,
  'Warehouse / Tankages / Silos': 0.6,
  'Logistics Hub / Center': 1.1,
  'Food Processing Plant': 0.9,
  'Research Centre': 1.2,
  'Air Cargo Terminal': 1.6,
  Shipyard: 2,
};
const NAME_NOUN: Record<string, string[]> = {
  'High Rise (15+)': ['Tower', 'Towers', 'Residences', 'Heights'],
  'Mid Rise (4 - 14)': ['Residences', 'Apartments', 'Court', 'Gardens'],
  'Low Rise (1 -3)': ['Villas', 'Townhouses', 'Compound', 'Community'],
  'Data Center': ['Data Centre', 'Data Campus'],
  Showroom: ['Showroom', 'Motor Showroom'],
  'Service Centre': ['Service Centre', 'Service Hub'],
  Hotel: ['Hotel', 'Grand Hotel', 'Hotel and Residences'],
  Resort: ['Resort', 'Beach Resort', 'Island Resort'],
  'Hotel Apartments': ['Hotel Apartments', 'Suites'],
  'Serviced Apartments': ['Serviced Residences', 'Serviced Apartments'],
  School: ['School', 'Academy', 'International School'],
  'University / College': ['University', 'College', 'Institute'],
  Library: ['Library', 'Public Library'],
  'Training Centre': ['Training Centre', 'Skills Centre'],
  Hospital: ['Hospital', 'General Hospital', 'Specialty Hospital'],
  'Medical / Research center': ['Medical Centre', 'Research Hospital'],
  Clinic: ['Clinic', 'Polyclinic', 'Day Surgery Centre'],
  'Shopping Mall': ['Mall', 'Shopping Centre', 'Galleria'],
  Park: ['Park', 'Community Park', 'Waterfront Park'],
  'Sports Club & Facilities': ['Sports Club', 'Sports Complex', 'Arena'],
  Stadium: ['Stadium', 'Arena'],
  'Landmark, Museum & Galleries': ['Museum', 'Gallery', 'Cultural Centre'],
  'Golf Course': ['Golf Club', 'Golf Course'],
  'Theme Park': ['Theme Park', 'Adventure Park'],
  'Mega Urban Development': ['District', 'City', 'Masterplan', 'Waterfront'],
  Mosque: ['Mosque', 'Grand Mosque'],
  Road: ['Road', 'Highway', 'Corridor', 'Interchange'],
  Bridge: ['Bridge', 'Crossing'],
  Tunnel: ['Tunnel'],
  'Sewerage / Drainage Network': ['Drainage Scheme', 'Sewer Network'],
  'Pumping Station': ['Pumping Station', 'Lift Station'],
  'Canal / Waterway': ['Canal', 'Waterway'],
  'Warehouse / Tankages / Silos': ['Warehouse', 'Storage Facility', 'Tank Farm'],
  'Logistics Hub / Center': ['Logistics Park', 'Distribution Centre', 'Logistics Hub'],
  'Factory / Plant / Farm': ['Plant', 'Works', 'Manufacturing Facility', 'Production Facility'],
  'Light Industrial/Workshop': ['Workshops', 'Industrial Units', 'Light Industrial Park'],
  'Food Processing Plant': ['Food Plant', 'Processing Facility'],
  'Cold Store': ['Cold Store', 'Cold Chain Facility'],
  'Mega Industrial Development': ['Industrial City', 'Industrial Zone', 'Industrial Park'],
  'Research Centre': ['Research Centre', 'Innovation Centre'],
  'Gas / Petrol Station': ['Fuel Station', 'Service Station'],
  Pipeline: ['Pipeline', 'Transfer Line'],
  Refinery: ['Refinery', 'Processing Complex'],
  'Offshore Platform': ['Offshore Platform', 'Offshore Facility'],
  'Hydrogen Plants': ['Hydrogen Plant', 'Green Fuels Plant'],
  Airport: ['Airport Terminal', 'Airfield', 'Airport Expansion'],
  'Hangar facility': ['Hangar', 'Maintenance Hangar'],
  'Air Cargo Terminal': ['Cargo Terminal', 'Air Freight Centre'],
  'Port & Harbor': ['Port', 'Harbour', 'Container Terminal'],
  Shipyard: ['Shipyard', 'Marine Works'],
  Railway: ['Rail Link', 'Railway Line'],
  'Metro Station': ['Metro Station', 'Transit Station'],
  'Rail Depot': ['Rail Depot', 'Rolling Stock Depot'],
  'Renewable Energy Plant': ['Solar Park', 'Wind Farm', 'Solar Plant'],
  'Nuclear Power Plant': ['Nuclear Plant'],
  Substation: ['Substation', 'Grid Station'],
  'Water Network': ['Water Network', 'Transmission Scheme'],
  'Dam / reservoir': ['Reservoir', 'Dam'],
  'Desalination Plant': ['Desalination Plant'],
  'Water Treatment Plant': ['Water Treatment Plant', 'Treatment Works'],
  'Waste to Energy Plant': ['Waste to Energy Plant', 'Energy Recovery Facility'],
};
for (const r of matrix) if (r.cells.every((cell) => cell === null)) throw new Error(`no relevance mapping for ${r.type}`);

const CONSULTANT_FILL = 0.92;
const MEP_CONSULTANT_FILL = 0.24;
/**
 * Share of rows with a main or EPC contractor recorded, by stage. The register names a
 * contractor early (pre-qualified at concept and design, appointed by tender), and the
 * record thins on the older completed rows, which is what leaves the source share of the
 * register unassigned under the cascade's "held" gate. The resulting overall fill and the
 * owned share are both declared ranges in data/shape.ts and checked before anything is written.
 */
const CONTRACTOR_FILL_BY_STAGE: Record<Stage, number> = { Concept: 0.55, Design: 0.7, Tender: 0.85, 'Under Construction': 0.85, 'Completed (3 months)': 0.6, 'Completed (1 year)': 0.45, 'Completed (3 years)': 0.3, 'Completed (above 3 years)': 0.18 };
/** MEP contractor fill as a share of the main-contractor fill, so about a fifth of the register overall. */
const MEP_CONTRACTOR_SHARE = 0.28;
/**
 * The no-relationship cohort: a KNOWN firm Halvard has never worked with. Drawn by how much
 * of the firm's book Halvard owns and how big the book is: a firm with no owned project is
 * usually a stranger, a small book often is, a large book almost never. Synthetic, declared
 * on the Data basis page, and the answer to "where do we have no relationship at all".
 */
const NO_RELATIONSHIP_P = { noOwnedProject: 0.6, smallBook: 0.2, midBook: 0.05 };

function drawValue(type: string): number {
  /* Match the supplied BNC source shape: p10 about 1m, median about 15m, p90 about 266m, maximum 27bn. */
  const base = Math.exp(Math.log(13.5) + 2.2 * gauss() * 0.84) * (VALUE_MULT[type] ?? 1);
  return r1(Math.min(27000, Math.max(0.5, base)));
}

function drawCompletion(stage: Stage): number | null {
  if (stage !== 'Under Construction') return null;
  if (rnd() < 0.79) return 0;
  return r1(Math.min(100, -Math.log(1 - rnd()) * 22));
}

function drawCompletionDate(stage: Stage, completion: number | null): string {
  switch (stage) {
    case 'Concept':
      return addDays(DATA_AS_OF, int(720, 1800));
    case 'Design':
      return addDays(DATA_AS_OF, int(540, 1440));
    case 'Tender':
      return addDays(DATA_AS_OF, int(365, 1100));
    case 'Under Construction':
      return addDays(DATA_AS_OF, int(120, Math.max(180, Math.round(1100 * (1 - (completion ?? 0) / 100)))));
    case 'Completed (3 months)':
      return addDays(DATA_AS_OF, -int(1, 90));
    case 'Completed (1 year)':
      return addDays(DATA_AS_OF, -int(91, 365));
    case 'Completed (3 years)':
      return addDays(DATA_AS_OF, -int(366, 1095));
    case 'Completed (above 3 years)':
      return addDays(DATA_AS_OF, -int(1096, 2900));
  }
}

function drawAttributes(sector: Sector, industry: string, type: string): Attribute[] {
  const out: Attribute[] = [];
  if (type === 'Data Center') out.push('Data Center');
  if (industry === 'Buildings' || industry === 'Mega Urban Development') {
    const mix = weighted(['Residential', 'Commercial', 'Office', 'Complex', 'Residential+Commercial', 'Office+Commercial'] as const, [30, 18, 14, 12, 16, 10]);
    for (const a of mix.split('+') as Attribute[]) if (!out.includes(a)) out.push(a);
    if (type === 'Low Rise (1 -3)' && rnd() < 0.1) out.push('Labor Camp');
  }
  if (industry === 'Hospitality' || industry === 'Retail Facilities') out.push('Commercial');
  if (industry === 'Education' && rnd() < 0.25) out.push('Staff / Student Accommodation');
  if (sector === 'Industrial' && rnd() < 0.12) out.push('Labor Camp');
  return out;
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}

interface Draft extends Omit<Project, 'ownerVertical' | 'ownerEngineer' | 'why' | 'buckets' | 'bucketDates' | 'scores' | 'adjusted' | 'overall' | 'description'> {
  row: number;
  sourceDescription: string;
}

const drafts: Draft[] = [];
const ownerId = new Map(owners.map((p) => [p.name, p.id]));
const consultantId = new Map(consultants.map((p) => [p.name, p.id]));
const contractorId = new Map(contractors.map((p) => [p.name, p.id]));
for (const p of bnc.projects) {
  const row = rowIndex.get(`${p.sector}|${p.industry}|${p.type}`);
  if (row === undefined) throw new Error(`no matrix row for ${p.ref}`);
  drafts.push({
    row,
    ref: p.ref,
    name: p.name,
    stage: p.stage,
    completionPct: p.completionPct,
    completionDate: p.completionDate,
    value: p.value,
    city: p.city,
    sector: p.sector,
    category: p.category,
    industry: p.industry,
    type: p.type,
    location: p.location,
    source: p.source,
    attributes: p.attributes,
    owners: p.owners.map((name) => ownerId.get(name)!),
    leadConsultants: p.leadConsultants.map((name) => consultantId.get(name)!),
    mepConsultant: p.mepConsultants.length ? consultantId.get(p.mepConsultants[0]!)! : null,
    mainContractors: p.mainContractors.map((name) => contractorId.get(name)!),
    mepContractor: p.mepContractors.length ? contractorId.get(p.mepContractors[0]!)! : null,
    lastUpdated: p.lastUpdated,
    sourceDescription: p.description,
  });
}
if (bnc.projects.length === 0) for (let n = 0; n < TARGET_PROJECTS; n++) {
  const row = weighted(
    matrix.map((_, i) => i),
    rowWeight,
  );
  const r = matrix[row]!;
  const stage = weighted(STAGES, STAGES.map((s) => STAGE_W[s]));
  const completionPct = drawCompletion(stage);
  const city = weighted(CITIES, CITIES.map((c) => CITY_W[c]));
  const category: Category = rnd() < (stage.startsWith('Completed') ? 0.12 : 0.16) ? 'Brownfield' : 'Greenfield';
  const ref = `HV-26-${String(n + 1).padStart(5, '0')}`;
  const name = unique(() => `${word()} ${pick(NAME_NOUN[r.type]!)}${rnd() < 0.15 ? ` Phase ${int(2, 4)}` : ''}`);
  const nOwners = rnd() < 0.06 ? 0 : rnd() < 0.9 ? 1 : 2;
  const ownerIds: number[] = [];
  while (ownerIds.length < nOwners) {
    const o = weighted(owners, ownerW);
    if (!ownerIds.includes(o.id)) ownerIds.push(o.id);
  }
  const leadIds: number[] = [];
  if (rnd() < CONSULTANT_FILL) {
    const n1 = rnd() < 0.85 ? 1 : 2;
    while (leadIds.length < n1) leadIds.push(drawParty(consultants, (x) => x !== 'mep', leadIds).id);
  }
  const mepC = rnd() < MEP_CONSULTANT_FILL ? drawParty(consultants, (x) => x !== 'lead', leadIds).id : null;
  const mainIds: number[] = [];
  /* a contractor is recorded on most rows under construction, on fewer at design (pre-qualified), and on fewer old completed rows */
  const contractorFill = CONTRACTOR_FILL_BY_STAGE[stage];
  if (rnd() < contractorFill) {
    const n2 = rnd() < 0.88 ? 1 : 2;
    while (mainIds.length < n2) mainIds.push(drawParty(contractors, (x) => x !== 'mep', mainIds).id);
  }
  const mepK = rnd() < contractorFill * MEP_CONTRACTOR_SHARE ? drawParty(contractors, (x) => x !== 'lead', mainIds).id : null;
  drafts.push({
    row,
    ref,
    name,
    stage,
    completionPct,
    completionDate: drawCompletionDate(stage, completionPct),
    value: drawValue(r.type),
    city,
    sector: r.sector,
    category,
    industry: r.industry,
    type: r.type,
    attributes: drawAttributes(r.sector, r.industry, r.type),
    owners: ownerIds,
    leadConsultants: leadIds,
    mepConsultant: mepC,
    mainContractors: mainIds,
    mepContractor: mepK,
    lastUpdated: addDays(DATA_AS_OF, -Math.round(Math.pow(rnd(), 1.6) * 540)),
    location: '',
    source: 'urban_industrial',
    sourceDescription: '',
  });
}

/* ---------- scores: the matrix lookup, plus a few hand adjustments ---------- */

const channels = verticals.map((v) => v.channel);
const projects: Project[] = [];
const assignedSoFar = verticals.map(() => 0);
const pipeline = new Map<string, number>(engineers.map((e) => [e.slug, 0]));
const ownerName = new Map(owners.map((o) => [o.id, o.name]));
const consultantName = new Map(consultants.map((c) => [c.id, c.name]));
const contractorName = new Map(contractors.map((c) => [c.id, c.name]));

/** Bucket weights by score band, then stage and ownership multipliers. Index order is BUCKETS. */
const BAND_W: Record<'none' | 'low' | 'medium' | 'high', number[]> = {
  none: [0, 0, 0, 0, 3, 0, 5, 5, 5, 12, 70],
  low: [0, 0, 0, 5, 6, 3, 8, 10, 8, 15, 45],
  medium: [2, 4, 6, 6, 8, 6, 8, 17, 7, 12, 32],
  high: [4, 7, 8, 7, 8, 8, 8, 16, 6, 10, 24],
};
function bucketFor(score: number | null, stage: Stage, owned: boolean, contractorAppointed: boolean): BucketCode {
  const band = score == null ? 'none' : score < 3.5 ? 'low' : score < 6.5 ? 'medium' : 'high';
  const w = [...BAND_W[band]];
  const mul = (i: number, k: number) => {
    w[i] = (w[i] ?? 0) * k;
  };
  if (stage === 'Concept' || stage === 'Design') {
    mul(NOT_YET_AWARDED, 2);
    mul(ORDER_RECEIVED, 0.2);
    mul(QUOTE_SENT, 0.4);
  }
  if (stage.startsWith('Completed')) {
    mul(ORDER_RECEIVED, 2);
    mul(PROJECT_CLOSED, 1.8);
    mul(ENQUIRY_GENERATED, 0.3);
    mul(QUOTE_SENT, 0.5);
    mul(5, 0.3);
    mul(NOT_YET_AWARDED, 0.1);
  }
  if (contractorAppointed) mul(NOT_YET_AWARDED, 0.15);
  if (owned) {
    for (const i of [ENQUIRY_GENERATED, QUOTE_SENT, 3, 5, 6]) mul(i, 1.8);
    mul(NO_UPDATE, 0.5);
  }
  return weighted([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const, w);
}
function bucketDate(code: BucketCode): string {
  /* activity dates lean recent; "no update" leans old */
  const span = code === NO_UPDATE ? [120, 540] : code === NOT_YET_AWARDED ? [30, 400] : [1, 300];
  return addDays(DATA_AS_OF, -int(span[0]!, span[1]!));
}

for (const d of drafts) {
  const r = matrix[d.row]!;
  const scores: (number | null)[] = r.cells.map((c) => (c ? GRADE_SCORE[c] : null));
  const adjusted: number[] = [];
  if (bnc.projects.length === 0 && rnd() < 0.08) {
    const graded = scores.map((s, i) => (s == null ? -1 : i)).filter((i) => i >= 0);
    const k = Math.min(graded.length, int(1, 3));
    for (let j = 0; j < k; j++) {
      const i = pick(graded);
      if (adjusted.includes(i)) continue;
      adjusted.push(i);
      scores[i] = r1(Math.min(8, Math.max(0.5, scores[i]! + between(-1.9, 1.9))));
    }
    adjusted.sort((a, b) => a - b);
  }
  const graded = scores.filter((s): s is number => s != null);
  const overall = graded.length ? Math.max(...graded) : null;
  const contractorAppointed = d.mainContractors.length > 0 || d.mepContractor != null;
  const res = cascade({ stage: d.stage, completionPct: d.completionPct, contractorAppointed, scores, channels, assignedSoFar });
  let ownerEngineer: string | null = null;
  if (res.vertical != null) {
    const e = pickEngineer(roster(res.vertical), pipeline);
    ownerEngineer = e.slug;
    pipeline.set(e.slug, sum1([pipeline.get(e.slug) ?? 0, d.value]));
    assignedSoFar[res.vertical]!++;
  }
  const buckets = scores.map((s, i) => bucketFor(s, d.stage, res.vertical === i, contractorAppointed));
  const bucketDates = buckets.map((b) => bucketDate(b));
  /* each role gets its own clause, and the "none" sentence is used only when BOTH roles of a kind are absent (a lead-less project with an MEP consultant names that consultant) */
  const consultantClauses = [d.leadConsultants.length ? `Lead consultant ${d.leadConsultants.map((c) => consultantName.get(c)).join(' with ')}` : '', d.mepConsultant ? `MEP consultant ${consultantName.get(d.mepConsultant)}` : ''].filter(Boolean);
  const contractorClauses = [d.mainContractors.length ? `Main contractor ${d.mainContractors.map((c) => contractorName.get(c)).join(' and ')}` : '', d.mepContractor ? `MEP contractor ${contractorName.get(d.mepContractor)}` : ''].filter(Boolean);
  const who = [
    d.owners.length ? `Developed by ${d.owners.map((o) => ownerName.get(o)).join(' and ')}.` : 'The developer is not yet recorded.',
    consultantClauses.length ? `${consultantClauses.join('; ')}.` : 'No consultant recorded.',
    contractorClauses.length ? `${contractorClauses.join('; ')}.` : 'No contractor appointed.',
  ];
  const when = d.completionDate ? (d.stage.startsWith('Completed') ? `Completed ${monthLabel(d.completionDate)}.` : `Expected completion ${monthLabel(d.completionDate)}.`) : 'Completion date not recorded in the source workbook.';
  const valueWords = d.value > 0 ? `valued at USD ${d.value.toFixed(1)} million` : 'with no value recorded in the source workbook';
  const locationWords = d.location ? `, ${d.location}` : '';
  const generated = `${d.name} is a ${d.category.toLowerCase()} ${d.type.toLowerCase()} project in ${d.city}${locationWords}, ${valueWords}, at ${d.stage.toLowerCase()}${d.completionPct != null && d.completionPct > 0 ? ` (${d.completionPct.toFixed(1)} percent complete)` : ''}. ${who.join(' ')} ${when}`;
  const description = d.sourceDescription ? `${d.sourceDescription} ${generated}` : generated;
  const { row: _row, sourceDescription: _sourceDescription, ...rest } = d;
  void _row;
  void _sourceDescription;
  projects.push({ ...rest, description, scores, adjusted, overall, ownerVertical: res.vertical, ownerEngineer, why: res.why, buckets, bucketDates });
}

/* ---------- parties: relationships derived from the register ---------- */

for (const p of projects) {
  for (const c of p.leadConsultants) consultants[c - 1]!.projects.add(p.ref);
  if (p.mepConsultant) consultants[p.mepConsultant - 1]!.projects.add(p.ref);
  for (const c of p.mainContractors) contractors[c - 1]!.projects.add(p.ref);
  if (p.mepContractor) contractors[p.mepContractor - 1]!.projects.add(p.ref);
}
const byRef = new Map(projects.map((p) => [p.ref, p]));
const relationshipsHeld = new Map<string, number>(engineers.map((e) => [e.slug, 0]));
function finishParty(d: PartyDraft): Party | null {
  if (d.projects.size === 0) return null;
  const refs = [...d.projects].sort();
  const ps = refs.map((r) => byRef.get(r)!);
  const value = sum1(ps.map((p) => p.value));
  /* the verticals it matters to: per vertical, its projects graded Medium or High (score 3.5 or more), count and value, all ten published so no list is a hidden top-N */
  const verticalCounts = verticals.map(() => 0);
  const verticalTenths = verticals.map(() => 0);
  for (const p of ps)
    p.scores.forEach((s, i) => {
      if (s != null && s >= 3.5) {
        verticalCounts[i]!++;
        verticalTenths[i]! += Math.round(p.value * 10);
      }
    });
  const verticalValues = verticalTenths.map((t) => t / 10);
  const topVertical = verticalCounts.map((c, i) => ({ c, i })).sort((a, b) => b.c - a.c || a.i - b.i)[0]!.i;
  const n = refs.length;
  /* the relationship, or none: a firm Halvard has never worked with has no level, no rating and no owner, all three together */
  const owned = new Map<string, number>();
  for (const p of ps) if (p.ownerEngineer) owned.set(p.ownerEngineer, (owned.get(p.ownerEngineer) ?? 0) + 1);
  const pNone = owned.size === 0 ? NO_RELATIONSHIP_P.noOwnedProject : n <= 3 ? NO_RELATIONSHIP_P.smallBook : n <= 8 ? NO_RELATIONSHIP_P.midBook : 0;
  const base = { id: d.id, name: d.name, kind: d.kind, role: d.role, verticalCounts, verticalValues, projectCount: n, projectValue: value, projects: refs };
  if (rnd() < pNone) return { ...base, level: null, rating: null, owner: null };
  /* owner: the engineer owning most of its projects; else the engineer holding the fewest relationships on its top vertical */
  let owner: string;
  if (owned.size) owner = [...owned.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
  else owner = pickEngineer(roster(topVertical), relationshipsHeld).slug;
  relationshipsHeld.set(owner, (relationshipsHeld.get(owner) ?? 0) + 1);
  const level: RelationshipLevel = weighted(['Junior management', 'Middle management', 'Senior management'] as const, n >= 12 ? [10, 40, 50] : n >= 5 ? [30, 50, 20] : [55, 35, 10]);
  const rating = Math.max(1, Math.min(10, Math.round((level === 'Senior management' ? 7 : level === 'Middle management' ? 5 : 3) + gauss() * 1.5)));
  return { ...base, level, rating, owner };
}
const consultantsOut = consultants.map(finishParty).filter((p): p is Party => p !== null);
const contractorsOut = contractors.map(finishParty).filter((p): p is Party => p !== null);
const usedOwnerIds = new Set(projects.flatMap((p) => p.owners));
const ownersOut = owners.filter((o) => usedOwnerIds.has(o.id));

/* ---------- rollups ---------- */

const ownedProjects = projects.filter((p) => p.ownerVertical != null);
const pairs = projects.flatMap((p) => p.buckets.map((b, i) => ({ b, i, date: p.bucketDates[i]!, p })));
const funnel = BUCKETS.map((_, code) => pairs.filter((x) => x.b === code).length);
const funnelProjects = BUCKETS.map((_, code) => projects.filter((p) => bestBucket(p.buckets) === code).length);
const kpis = {
  projects: projects.length,
  owned: ownedProjects.length,
  ownedValue: sum1(ownedProjects.map((p) => p.value)),
  openEnquiriesAndQuotes: pairs.filter((x) => x.b === ENQUIRY_GENERATED || x.b === QUOTE_SENT).length,
  ordersThisYear: pairs.filter((x) => x.b === ORDER_RECEIVED && x.date.startsWith(String(FISCAL_YEAR))).length,
  unowned: projects.length - ownedProjects.length,
};
const sectorStage: SectorStageCell[] = SECTORS.flatMap((sector) =>
  STAGES.map((stage) => {
    const ps = projects.filter((p) => p.sector === sector && p.stage === stage);
    return { sector, stage, count: ps.length, value: sum1(ps.map((p) => p.value)) };
  }),
);
function door(p: Project): ChaseRow['door'] {
  const gate = stageGate(p.stage, p.completionPct, p.mainContractors.length > 0 || p.mepContractor != null);
  if (gate === 'specification') {
    if (p.mepConsultant) return { kind: 'consultant', id: p.mepConsultant, name: consultantName.get(p.mepConsultant)! };
    if (p.leadConsultants[0]) return { kind: 'consultant', id: p.leadConsultants[0], name: consultantName.get(p.leadConsultants[0])! };
    return null;
  }
  if (p.mainContractors[0]) return { kind: 'contractor', id: p.mainContractors[0], name: contractorName.get(p.mainContractors[0])! };
  if (p.mepContractor) return { kind: 'contractor', id: p.mepContractor, name: contractorName.get(p.mepContractor)! };
  if (p.leadConsultants[0]) return { kind: 'consultant', id: p.leadConsultants[0], name: consultantName.get(p.leadConsultants[0])! };
  return null;
}
const chase: ChaseRow[] = projects
  .filter((p) => worthChasing(p.stage, p.completionPct, p.overall, p.buckets))
  .sort((a, b) => b.value - a.value || a.ref.localeCompare(b.ref))
  .slice(0, 20)
  .map((p) => ({ ref: p.ref, name: p.name, stage: p.stage, completionPct: p.completionPct, value: p.value, city: p.city, type: p.type, overall: p.overall!, ownerVertical: p.ownerVertical, ownerEngineer: p.ownerEngineer, door: door(p) }));
const verticalSummary: VerticalSummary[] = verticals.map((v, vi) => {
  const owned = projects.filter((p) => p.ownerVertical === vi);
  return { slug: v.slug, name: v.name, channel: v.channel, engineers: roster(vi).length, owned: owned.length, ownedValue: sum1(owned.map((p) => p.value)), funnel: BUCKETS.map((_, code) => projects.filter((p) => p.buckets[vi] === code).length) };
});
const engineerSummary: EngineerSummary[] = engineers.map((e) => {
  const vi = vIndex.get(e.vertical)!;
  const owned = projects.filter((p) => p.ownerEngineer === e.slug);
  const cons = new Set(owned.flatMap((p) => [...p.leadConsultants, ...(p.mepConsultant ? [p.mepConsultant] : [])]));
  const cons2 = new Set(consultantsOut.filter((c) => c.owner === e.slug).map((c) => c.id));
  const cont = new Set(owned.flatMap((p) => [...p.mainContractors, ...(p.mepContractor ? [p.mepContractor] : [])]));
  const cont2 = new Set(contractorsOut.filter((c) => c.owner === e.slug).map((c) => c.id));
  const funnelE = BUCKETS.map((_, code) => owned.filter((p) => p.buckets[vi] === code).length);
  const workload = workloadOf(funnelE);
  return {
    slug: e.slug,
    name: e.name,
    vertical: e.vertical,
    owned: owned.length,
    ownedValue: sum1(owned.map((p) => p.value)),
    funnel: funnelE,
    workload,
    capacity: ENGINEER_CAPACITY,
    loadPct: pctOf(workload, ENGINEER_CAPACITY),
    overloaded: workload > ENGINEER_CAPACITY,
    top: [...owned]
      .sort((a, b) => b.value - a.value || a.ref.localeCompare(b.ref))
      .slice(0, 5)
      .map((p) => ({ ref: p.ref, name: p.name, value: p.value, stage: p.stage })),
    consultants: new Set([...cons, ...cons2]).size,
    contractors: new Set([...cont, ...cont2]).size,
  };
});
const matrixRows = matrix.map((_r, i) => {
  const ps = projects.filter((p) => rowIndex.get(`${p.sector}|${p.industry}|${p.type}`) === i);
  return { count: ps.length, value: sum1(ps.map((p) => p.value)) };
});

/* ---------- the matrix summary: reach by vertical, and the headline cards of the matrix page ---------- */

const reach: VerticalReach[] = verticals.map((v, vi) => {
  const rows = matrix.map((r) => r.cells[vi]);
  const graded = (g: 'High' | 'Medium' | 'Low') => projects.filter((p) => gradeOf(p.scores[vi]!) === g);
  return {
    slug: v.slug,
    name: v.name,
    rowsHigh: rows.filter((c) => c === 'High').length,
    rowsMedium: rows.filter((c) => c === 'Medium').length,
    rowsLow: rows.filter((c) => c === 'Low').length,
    rowsNone: rows.filter((c) => c === null).length,
    projectsHigh: graded('High').length,
    projectsMedium: graded('Medium').length,
    projectsLow: graded('Low').length,
    valueHigh: sum1(graded('High').map((p) => p.value)),
  };
});
const widest = [...reach].sort((a, b) => b.rowsHigh - a.rowsHigh || a.slug.localeCompare(b.slug))[0]!;
const topTypeRow = matrix
  .map((r, i) => ({ r, i, highs: r.cells.filter((c) => c === 'High').length, projects: matrixRows[i]!.count }))
  .sort((a, b) => b.highs - a.highs || b.projects - a.projects || a.i - b.i)[0]!;
const overallHigh = projects.filter((p) => gradeOf(p.overall) === 'High');
const matrixSummary: MatrixSummary = {
  cellsGraded: matrix.reduce((a, r) => a + r.cells.filter(Boolean).length, 0),
  cellsTotal: matrix.length * V,
  projectsOverallHigh: overallHigh.length,
  valueOverallHigh: sum1(overallHigh.map((p) => p.value)),
  projectsBelowFloor: projects.filter((p) => p.why.eligible.length === 0).length,
  projectsAdjusted: projects.filter((p) => p.adjusted.length > 0).length,
  widestVertical: { slug: widest.slug, name: widest.name, rowsHigh: widest.rowsHigh },
  topType: { type: topTypeRow.r.type, industry: topTypeRow.r.industry, sector: topTypeRow.r.sector, cellsHigh: topTypeRow.highs, projects: topTypeRow.projects },
  reach,
};

/* ---------- the party summary: the cards and the top-firms chart of the parties page ---------- */

function kindSummary(list: Party[]): PartyKindSummary {
  const rank = (p: Party): PartyRank => ({ id: p.id, name: p.name, role: p.role, level: p.level, rating: p.rating, owner: p.owner, projectCount: p.projectCount, projectValue: p.projectValue });
  return {
    total: list.length,
    senior: list.filter((p) => p.level === 'Senior management').length,
    middle: list.filter((p) => p.level === 'Middle management').length,
    junior: list.filter((p) => p.level === 'Junior management').length,
    noRelationship: list.filter((p) => p.level === null).length,
    noRelationshipValue: sum1(list.filter((p) => p.level === null).map((p) => p.projectValue)),
    averageRating: (() => {
      const rated = list.map((p) => p.rating).filter((r): r is number => r !== null);
      return rated.length ? r1(sum(rated) / rated.length) : 0;
    })(),
    onTenPlus: list.filter((p) => p.projectCount >= 10).length,
    bookValue: sum1(list.map((p) => p.projectValue)),
    top: [...list]
      .sort((a, b) => b.projectValue - a.projectValue || b.projectCount - a.projectCount || a.id - b.id)
      .slice(0, 20)
      .map(rank),
  };
}
const partySummary: PartySummary = {
  consultants: kindSummary(consultantsOut),
  contractors: kindSummary(contractorsOut),
  projectsNoConsultant: projects.filter((p) => p.leadConsultants.length === 0 && p.mepConsultant === null).length,
  projectsNoContractor: projects.filter((p) => p.mainContractors.length === 0 && p.mepContractor === null).length,
  openProjectsNoContractor: projects.filter((p) => stageGate(p.stage, p.completionPct, false) === 'buying' && p.mainContractors.length === 0 && p.mepContractor === null).length,
};

/* ---------- self-checks before anything is written ---------- */

function expect(cond: boolean, what: string) {
  if (!cond) throw new Error(`generator self-check failed: ${what}`);
}
expect(projects.length === TARGET_PROJECTS, 'project count');
expect(new Set(projects.map((p) => p.ref)).size === projects.length, 'unique references');
expect(sum(funnel) === projects.length * V, 'funnel covers every pair');
expect(sum(funnelProjects) === projects.length, 'project funnel covers every project');
expect(sum(verticalSummary.map((v) => v.owned)) === kpis.owned, 'vertical owned sums to owned');
expect(sum(engineerSummary.map((e) => e.owned)) === kpis.owned, 'engineer owned sums to owned');
expect(sum1(engineerSummary.map((e) => e.ownedValue)) === kpis.ownedValue, 'engineer value sums to owned value');
expect(sum(matrixRows.map((m) => m.count)) === projects.length, 'matrix rows cover every project');
for (const e of engineerSummary) expect(sum(e.funnel) === e.owned, `funnel of ${e.slug}`);
const ownedShare = kpis.owned / kpis.projects;
const quiet = (funnel[7]! + funnel[NO_UPDATE]!) / sum(funnel);
const orders = funnel[ORDER_RECEIVED]! / sum(funnel);
const closed = funnel[PROJECT_CLOSED]! / sum(funnel);
const books = engineerSummary.map((e) => e.owned);
for (const p of projects) {
  expect(p.scores.length === V && p.buckets.length === V && p.bucketDates.length === V, `vector lengths on ${p.ref}`);
  expect(Math.round(p.value * 10) === p.value * 10 || Math.abs(Math.round(p.value * 10) - p.value * 10) < 1e-6, `value precision on ${p.ref}`);
  /* the description must agree with the parties it describes (a lead-less project with an MEP consultant is not "No consultant recorded") */
  expect(p.description.includes('No consultant recorded') === (p.leadConsultants.length === 0 && p.mepConsultant === null), `consultant sentence on ${p.ref}`);
  expect(p.mepConsultant === null || p.description.includes(`MEP consultant ${consultantName.get(p.mepConsultant)}`), `MEP consultant named on ${p.ref}`);
  expect(p.description.includes('No contractor appointed') === (p.mainContractors.length === 0 && p.mepContractor === null), `contractor sentence on ${p.ref}`);
  /* the tie decision record is complete: tied verticals, their counts, and which half of the rule decided */
  expect(p.why.tie === (p.why.tied.length > 1) && p.why.tied.length === p.why.assignedAtDecision.length && (p.why.tie ? p.why.tieRule !== null : p.why.tieRule === null), `tie record on ${p.ref}`);
}
for (const c of [...consultantsOut, ...contractorsOut]) {
  expect(c.projectCount === c.projects.length, `party ${c.name}`);
  /* a relationship is whole or absent: level, rating and owner are all set or all null */
  const held = c.level !== null;
  expect(held === (c.rating !== null) && held === (c.owner !== null) && (!held || (c.rating! >= 1 && c.rating! <= 10)), `relationship state of ${c.name}`);
  expect(c.verticalCounts.length === V && c.verticalValues.length === V && Math.max(...c.verticalCounts) <= c.projectCount, `vertical vectors of ${c.name}`);
}

/* ---------- the declared source shape, measured before anything is written ---------- */

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
const allParties = [...consultantsOut, ...contractorsOut];
const measuredShape: Record<string, number> = {
  ownedShare: pctOf(kpis.owned, kpis.projects),
  smallestBook: Math.min(...books),
  largestBook: Math.max(...books),
  quietShare: pctOf(funnel[7]! + funnel[NO_UPDATE]!, sum(funnel)),
  ordersShare: pctOf(funnel[ORDER_RECEIVED]!, sum(funnel)),
  closedShare: pctOf(funnel[PROJECT_CLOSED]!, sum(funnel)),
  mepConsultantFill: pctOf(projects.filter((p) => p.mepConsultant !== null).length, projects.length),
  mainContractorFill: pctOf(projects.filter((p) => p.mainContractors.length > 0).length, projects.length),
  mepContractorFill: pctOf(projects.filter((p) => p.mepContractor !== null).length, projects.length),
  consultantMedian: median(consultantsOut.map((c) => c.projectCount)),
  consultantMax: Math.max(...consultantsOut.map((c) => c.projectCount)),
  contractorMedian: median(contractorsOut.map((c) => c.projectCount)),
  contractorMax: Math.max(...contractorsOut.map((c) => c.projectCount)),
  noRelationshipShare: pctOf(allParties.filter((p) => p.level === null).length, allParties.length),
};
const shape: ShapeCheck[] = SHAPE_TARGETS.map((t) => {
  const measured = measuredShape[t.key];
  if (measured === undefined) throw new Error(`shape target ${t.key} has no measurement`);
  return { ...t, measured, pass: measured >= t.lo && measured <= t.hi };
});
const shapeMisses = shape.filter((s) => !s.pass).map((s) => `${s.label}: measured ${s.measured} ${s.unit}, declared ${s.lo} to ${s.hi}`);
expect(shapeMisses.length === 0, `source shape, ${shapeMisses.length} declared range(s) missed:\n  ${shapeMisses.join('\n  ')}\n  (all measured: ${JSON.stringify(measuredShape)})`);
const overloaded = engineerSummary.filter((e) => e.overloaded).length;
expect(overloaded >= 2 && overloaded <= 8, `overloaded engineers ${overloaded} of ${engineers.length}; retune ENGINEER_CAPACITY in data/rules.ts`);
expect(sum(reach.map((r) => r.rowsHigh + r.rowsMedium + r.rowsLow)) === matrixSummary.cellsGraded, 'reach rows sum to graded cells');
for (const r of reach) expect(r.rowsHigh + r.rowsMedium + r.rowsLow + r.rowsNone === matrix.length, `reach rows of ${r.slug}`);

/* ---------- definitions, policy, assumptions ---------- */

const definitions: Record<string, Definition> = Object.fromEntries(
  (
    [
      ['register', 'Market register', 'One row per construction project known to the market, with its stage, value, location, taxonomy, parties and a relevance score per vertical.'],
      ['relevance', 'Relevance score', `The grade of the project's type on the relevance matrix, converted to a number: High ${GRADE_SCORE.High}, Medium ${GRADE_SCORE.Medium}, Low ${GRADE_SCORE.Low}, none blank. A few rows carry a hand-adjusted score between the grades, shown to one decimal.`],
      ['overall', 'Overall relevance', 'The highest of the ten vertical scores.'],
      ['owner', 'Owner', 'The engineer the ownership cascade assigns the project to, or none. Each project has at most one owner.'],
      ['pipeline', 'Pipeline value owned', 'The sum of the BNC whole-project values assigned to an engineer, in USD million. It is opportunity coverage, not booked revenue.'],
      ['bucket', 'Activity bucket', 'Exactly one sales-activity state per project and vertical, chosen by priority: the highest-priority thing that has happened wins.'],
      ['open', 'Open enquiries and quotes', 'Project-and-vertical pairs whose bucket is Enquiry generated or Quote sent.'],
      ['orders', 'Orders received this year', `Project-and-vertical pairs whose bucket is Order received with an activity date in ${FISCAL_YEAR}.`],
      ['chase', 'Worth chasing now', `Projects at Tender, or under construction at ${BUYING_COMPLETION_FLOOR_PCT.toFixed(1)} percent or less, with overall relevance ${(5).toFixed(1)} or more and no vertical in Project closed; the top twenty by value.`],
      ['door', 'Door in', 'The party through which the owning vertical reaches the project: at specification stage the MEP consultant, else the lead consultant; at buying stage the main contractor, else the MEP contractor, else the lead consultant.'],
      ['level', 'Relationship level', 'The highest management level Halvard has a working relationship with at the party: junior, middle or senior management. A known firm Halvard has never worked with has no level, no rating and no owner.'],
      ['rating', 'Relationship rating', 'A whole number from 1 to 10 recorded by the relationship owner; none where there is no relationship.'],
      ['workload', 'Workload', `Synthetic points per engineer: each owned project counts ${WORKLOAD_WEIGHTS.active} when its bucket on the engineer's vertical is active (quote, enquiry, profile shared, visit, reached out), ${WORKLOAD_WEIGHTS.won} for an order or a waiting or quiet bucket, ${WORKLOAD_WEIGHTS.closed} when closed. An engineer is over capacity above ${ENGINEER_CAPACITY} points.`],
      ['norel', 'No relationship yet', 'A firm on the register that Halvard has never worked with: its level, rating and owner are all blank. Not the same as a low rating.'],
      ['value', 'Value', 'The project value in source USD million to one decimal. Zero means the BNC source workbook did not record a value.'],
      ['completion', 'Completion', 'Percent complete from the BNC workbook, shown for projects under construction when recorded.'],
    ] as const
  ).map(([key, term, text]) => [key, { key, term, text }]),
);
const precisionPolicy = [
  'Money remains in source USD and is stored as USD million to one decimal at project level; every rollup sums those same one-decimal figures, so tables that show the same figure tie exactly.',
  'Relevance scores are 0.0 to 8.0 to one decimal. Grades convert to 8.0, 5.0 and 2.0; a hand-adjusted score keeps one decimal.',
  'Percentages are one decimal from the underlying sums, never from other percentages.',
  'Counts are whole numbers. Ratings are whole numbers from 1 to 10.',
  'Dates are calendar dates. Where the Other Sectors workbook has no per-project update date, its March 2026 workbook snapshot date is used and disclosed here.',
];
const assumptions = [
  `${bnc.metadata.rawRows.toLocaleString('en-GB')} supplied BNC rows resolve to ${TARGET_PROJECTS.toLocaleString('en-GB')} unique project references. ${bnc.metadata.overlapRows} newer-source overlaps are de-duplicated by BNC reference: Urban & Industrial first, Other Sectors next, Brownfield last.`,
  `Source rows: ${bnc.metadata.sources.map((s) => `${s.file} (${s.rows.toLocaleString('en-GB')})`).join('; ')}. Project references, names, values, stages, locations, sectors, industries, types, owners, consultants and contractors come from these workbooks.`,
  'Money is kept in the source USD currency. No AED conversion, scaling, capping or synthetic value generation is applied. Two source rows without a positive value remain in the register at 0.0 and are described as not recorded.',
  'Company cells are preserved as written. Because BNC uses commas both inside legal company names and between multiple companies, an ambiguous multi-company cell is shown as one source label rather than split incorrectly.',
  'Individual contact names, telephone numbers, email addresses and workbook assignee fields are deliberately excluded; project and company identities are retained.',
  `The 24 sales engineers are fictional. Relevance scores, internal ownership, activity, workload, relationship level, rating and relationship owner are deterministic illustrative demo fields because the supplied BNC workbooks do not contain those internal records. ${measuredShape.noRelationshipShare!.toFixed(1)} percent of firms form the illustrative no-relationship cohort.`,
  `Workload is a synthetic measure, ${WORKLOAD_WEIGHTS.active} points per active project on the engineer's own vertical and ${WORKLOAD_WEIGHTS.won} per order or quiet project, against a capacity of ${ENGINEER_CAPACITY} points chosen so a few of the 24 books exceed it.`,
];
const workloadRule = [
  `Each owned project earns the engineer points by its activity bucket on the engineer's own vertical: ${ACTIVITY_BANDS.map((b) => `${b.label.toLowerCase()} (${b.codes.map((c) => BUCKETS[c]).join(', ')}) ${WORKLOAD_WEIGHTS[b.key]}`).join('; ')}.`,
  `Workload is the sum of those points. Capacity is ${ENGINEER_CAPACITY} points for every engineer; an engineer whose workload exceeds it is over capacity.`,
  'Both are synthetic: an illustration of the kind of rule a capacity view needs, never a record of hours worked.',
];
const relationshipRule = [
  'A firm is known when it sits on at least one project of the register. Halvard holds a relationship with a known firm when a level, a rating and an owner are recorded; the three are always recorded together or not at all.',
  `The no-relationship cohort is drawn per firm: a firm with no project owned by Halvard has a ${Math.round(NO_RELATIONSHIP_P.noOwnedProject * 100)} percent chance of no relationship, a firm on three projects or fewer ${Math.round(NO_RELATIONSHIP_P.smallBook * 100)} percent, a firm on four to eight ${Math.round(NO_RELATIONSHIP_P.midBook * 100)} percent, and a larger book always has one.`,
  'The parties page filters on this state, and the "No relationship yet" figure counts exactly those firms.',
];
const cascadeText = [
  `Step 1, scope floor: a vertical is eligible for a project only when its score is ${SCOPE_FLOOR.toFixed(1)} or more.`,
  `Step 2, stage gate: Concept and Design projects go to a vertical that sells through consultants; Tender and Under Construction at ${BUYING_COMPLETION_FLOOR_PCT.toFixed(1)} percent or less go to a vertical that sells through contractors; Under Construction beyond that and Completed stay unassigned unless a contractor is already appointed, in which case they go to a vertical that sells through contractors.`,
  'Step 3, among eligible verticals that pass the gate the highest score wins; a tie goes to the vertical with fewer projects already assigned, then to the earlier vertical in the published order.',
  'Step 4, within the winning vertical the project goes to the engineer with the lowest current pipeline value, so loads are even but not equal.',
  'Step 5, a project with no eligible vertical, or none that passes the gate, has no owner and is counted in the unassigned figure.',
  'Projects are processed in reference order, so the running counts in steps 3 and 4 are reproducible.',
];
const bucketRule = [
  'Each project and vertical pair carries exactly one bucket, the highest on this list that applies:',
  ...BUCKETS.map((b, i) => `${i + 1}. ${b}`),
  'Order received counts as an order this year when its activity date falls in the fiscal year.',
];

const meta: Meta = {
  company: 'Halvard Engineering Group',
  division: 'Building Technologies Division',
  system: 'Project Intelligence System',
  dataAsOf: DATA_AS_OF,
  dataAsOfLabel: DATA_AS_OF_LABEL,
  fiscalYear: FISCAL_YEAR,
  currency: 'USD',
  unit: 'million',
  seed: SEED,
  registerName: 'the market register',
};

/* ---------- shards ---------- */

rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'projects'), { recursive: true });
mkdirSync(join(outDir, 'parties'), { recursive: true });
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const shards: Shard[] = [];
for (const sector of SECTORS) {
  const ps = projects.filter((p) => p.sector === sector);
  const parts = Math.max(1, Math.ceil(ps.length / SHARD_MAX));
  const size = Math.ceil(ps.length / parts);
  for (let i = 0; i < parts; i++) {
    const chunk = ps.slice(i * size, (i + 1) * size);
    const file = `projects/${slug(sector)}${parts > 1 ? `-${i + 1}` : ''}.json`;
    writeFileSync(join(outDir, file), JSON.stringify({ sector, projects: chunk }) + '\n');
    shards.push({ file, sector, count: chunk.length, value: sum1(chunk.map((p) => p.value)) });
  }
}
writeFileSync(join(outDir, 'parties', 'consultants.json'), JSON.stringify(consultantsOut) + '\n');
writeFileSync(join(outDir, 'parties', 'contractors.json'), JSON.stringify(contractorsOut) + '\n');
writeFileSync(join(outDir, 'parties', 'owners.json'), JSON.stringify(ownersOut) + '\n');

const rollup: Rollup = {
  meta,
  verticals,
  engineers,
  matrix,
  matrixRows,
  shards,
  kpis,
  sectorStage,
  chase,
  verticalSummary,
  engineerSummary,
  funnel,
  funnelProjects,
  parties: { consultants: consultantsOut.length, contractors: contractorsOut.length, owners: ownersOut.length },
  gradeScore: GRADE_SCORE,
  scopeFloor: SCOPE_FLOOR,
  buyingCompletionFloorPct: BUYING_COMPLETION_FLOOR_PCT,
  engineerCapacity: ENGINEER_CAPACITY,
  workloadWeights: WORKLOAD_WEIGHTS,
  definitions,
  precisionPolicy,
  assumptions,
  cascade: cascadeText,
  bucketRule,
  workloadRule,
  relationshipRule,
  shape,
  distributions: {
    stages: STAGES.map((stage) => ({ stage, count: projects.filter((p) => p.stage === stage).length })),
    sectors: SECTORS.map((sector) => ({ sector, count: projects.filter((p) => p.sector === sector).length })),
    cities: CITIES.map((city) => ({ city, count: projects.filter((p) => p.city === city).length })),
  },
  matrixSummary,
  partySummary,
};
writeFileSync(join(outDir, 'rollup.json'), JSON.stringify(rollup, null, 1) + '\n');

/* ---------- report ---------- */

const values = projects.map((p) => p.value).sort((a, b) => a - b);
const q = (f: number) => values[Math.min(values.length - 1, Math.floor(f * values.length))];
const filled = projects.filter((p) => p.completionPct != null).map((p) => p.completionPct!);
const fz = filled.filter((x) => x === 0).length / filled.length;
console.log(`Wrote ${projects.length} projects in ${shards.length} shards, ${consultantsOut.length} consultants, ${contractorsOut.length} contractors, ${ownersOut.length} owners.`);
console.log(`Owned ${kpis.owned} (${(ownedShare * 100).toFixed(1)}%), books ${Math.min(...books)} to ${Math.max(...books)}; value p10 ${q(0.1)} p50 ${q(0.5)} p90 ${q(0.9)} max ${values[values.length - 1]} USD m`);
console.log(`Buckets: quiet ${(quiet * 100).toFixed(1)}%, orders ${(orders * 100).toFixed(1)}%, closed ${(closed * 100).toFixed(1)}%; completion zeros ${(fz * 100).toFixed(0)}% of filled`);
console.log(`Gates: ${(['specification', 'buying', 'appointed', 'held', 'none'] as const).map((g) => `${g} ${projects.filter((p) => p.why.gate === g).length}`).join(', ')}`);
console.log(`Consultant books median ${measuredShape.consultantMedian}, max ${measuredShape.consultantMax}; contractor median ${measuredShape.contractorMedian}, max ${measuredShape.contractorMax}`);
console.log(`Fills: MEP consultant ${measuredShape.mepConsultantFill}%, main contractor ${measuredShape.mainContractorFill}%, MEP contractor ${measuredShape.mepContractorFill}%; no relationship ${measuredShape.noRelationshipShare}% of firms; workload over capacity ${overloaded} of ${engineers.length} (${engineerSummary.map((e) => e.workload).sort((a, b) => b - a).slice(0, 8).join(', ')} ...)`);
console.log(`Ties: fewer ${projects.filter((p) => p.why.tieRule === 'fewer').length}, order ${projects.filter((p) => p.why.tieRule === 'order').length}; shape ${shape.filter((s) => s.pass).length} of ${shape.length} declared ranges met`);

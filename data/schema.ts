/**
 * The one data contract every screen, the generator and the reconciliation read from.
 *
 * Money is source USD million to one decimal. Percentages are plain numbers to one decimal
 * (0.0 to 100.0). Scores are 0 to 8 to one decimal, or null where the matrix has no grade.
 * Counts are whole. No published file carries a timestamp: the data-as-of date is one
 * constant in the generator, so a re-run writes byte-identical files.
 */

export type Slug = string;

export const STAGES = ['Concept', 'Design', 'Tender', 'Under Construction', 'Completed (3 months)', 'Completed (1 year)', 'Completed (3 years)', 'Completed (above 3 years)'] as const;
export type Stage = (typeof STAGES)[number];

export const SECTORS = ['Urban Construction', 'Industrial', 'Oil, Gas and Fuels', 'Transport', 'Utilities'] as const;
export type Sector = (typeof SECTORS)[number];

export const CITIES = ['Abu Dhabi', 'Ajman', 'Al Ain', 'Dubai', 'Fujairah', 'Ras Al Khaimah', 'Sharjah', 'Umm Al Quwain'] as const;
export type City = (typeof CITIES)[number];

export const CATEGORIES = ['Greenfield', 'Brownfield'] as const;
export type Category = (typeof CATEGORIES)[number];

export const ATTRIBUTES = ['Commercial', 'Residential', 'Office', 'Complex', 'Labor Camp', 'Data Center', 'Staff / Student Accommodation'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const GRADES = ['High', 'Medium', 'Low'] as const;
export type Grade = (typeof GRADES)[number];
/** A matrix cell: a grade, or null where the vertical has no relevance to the type. */
export type Cell = Grade | null;

/** The eleven activity buckets, highest priority first. Index in this list is the published code. */
export const BUCKETS = [
  'Order received',
  'Quote sent',
  'Enquiry generated',
  'Company profile shared',
  'Project closed',
  'Visit done',
  'Reached out',
  'Waiting or follow up',
  'No response',
  'Contractor or consultant not yet awarded',
  'No update',
] as const;
export type Bucket = (typeof BUCKETS)[number];
/** Bucket code: the index into BUCKETS. */
export type BucketCode = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** How a vertical reaches a project: through the consultant who specifies, the contractor who buys, or both. */
export type Channel = 'consultants' | 'contractors' | 'both';

export interface Vertical {
  slug: Slug;
  name: string;
  channel: Channel;
}

export interface Engineer {
  slug: Slug;
  name: string;
  vertical: Slug;
}

/** One row of the relevance matrix: a (sector, industry, project type) combination with a grade per vertical. */
export interface MatrixRow {
  sector: Sector;
  industry: string;
  type: string;
  /** Grades in vertical order (rollup.verticals). */
  cells: Cell[];
}

/** Why a project has the owner it has: the cascade step that decided it, published as a code. */
export type OwnerGate = 'specification' | 'buying' | 'appointed' | 'held' | 'none';

/** How a top-score tie was broken: fewer projects already assigned, or the earlier vertical in the published order when the counts were equal. */
export type TieRule = 'fewer' | 'order';

export interface OwnerWhy {
  /** Verticals at or above the scope floor, in vertical order (indexes). */
  eligible: number[];
  /** The stage gate that fired. */
  gate: OwnerGate;
  /** Verticals that passed the gate (indexes). Empty when unassigned. */
  candidates: number[];
  /** True when two or more candidates shared the top score and the tie rule decided. */
  tie: boolean;
  /** The candidates that shared the top score (indexes, vertical order). Empty when there was no tie. */
  tied: number[];
  /** Projects already assigned to each tied vertical when this project was decided, in `tied` order. The decision record, so the drill can say which count won. */
  assignedAtDecision: number[];
  /** Which half of the tie rule decided, or null when there was no tie. */
  tieRule: TieRule | null;
}

/** One project of the market register. Party fields are ids into the party files. */
export interface Project {
  ref: string;
  name: string;
  stage: Stage;
  /** 0 to 100, one decimal; null unless under construction. */
  completionPct: number | null;
  /** ISO date, expected finish; null where the source workbook has no date. */
  completionDate: string | null;
  /** USD million, one decimal. Zero means the source workbook did not record a value. */
  value: number;
  city: City;
  sector: Sector;
  category: Category;
  industry: string;
  type: string;
  /** Source location text, which is more specific than city where recorded. */
  location: string;
  /** The supplied workbook this row came from. */
  source: 'urban_industrial' | 'other_sectors' | 'brownfield';
  attributes: Attribute[];
  /** Owner (client or developer) ids, 0 to 2. */
  owners: number[];
  /** Lead or design consultant ids, 0 to 2. */
  leadConsultants: number[];
  /** MEP consultant id or null. */
  mepConsultant: number | null;
  /** Main or EPC contractor ids, 0 to 2. */
  mainContractors: number[];
  /** MEP contractor id or null. */
  mepContractor: number | null;
  description: string;
  /** ISO date. */
  lastUpdated: string;
  /** Ten scores in vertical order, one decimal, or null. */
  scores: (number | null)[];
  /** Vertical indexes whose score was hand-adjusted away from the matrix grade. */
  adjusted: number[];
  /** Highest of the ten, or null when every score is null. */
  overall: number | null;
  /** Index of the owning vertical, or null. */
  ownerVertical: number | null;
  /** Slug of the owning engineer, or null. */
  ownerEngineer: Slug | null;
  why: OwnerWhy;
  /** Bucket code per vertical, in vertical order. */
  buckets: BucketCode[];
  /** ISO date of the last activity per vertical. */
  bucketDates: string[];
}

export interface Shard {
  file: string;
  sector: Sector;
  count: number;
  /** USD million, one decimal: the sum of the shard's project values. */
  value: number;
}

export type PartyKind = 'consultant' | 'contractor';
/** A consultant is Lead/Design, MEP, or both; a contractor is Main/EPC, MEP, or both. */
export type PartyRole = 'lead' | 'mep' | 'both';
export type RelationshipLevel = 'Junior management' | 'Middle management' | 'Senior management';

/**
 * A firm on the register. A firm may be KNOWN (it sits on projects) without the group holding
 * any relationship with it: then level, rating and owner are all null together. That is the
 * "no relationship yet" state the parties page filters on; it is never implied by a low rating.
 */
export interface Party {
  id: number;
  name: string;
  kind: PartyKind;
  role: PartyRole;
  /** Per vertical, in vertical order: projects of this firm graded Medium or High (score 3.5 or more) on that vertical. */
  verticalCounts: number[];
  /** Per vertical, in vertical order: USD million of those projects. */
  verticalValues: number[];
  /** Null when the group holds no relationship with the firm. */
  level: RelationshipLevel | null;
  /** 1 to 10, whole; null when no relationship. */
  rating: number | null;
  /** Relationship owner, an engineer slug; null when no relationship. */
  owner: Slug | null;
  projectCount: number;
  /** USD million, one decimal. */
  projectValue: number;
  /** Project references. */
  projects: string[];
}

export interface Owner {
  id: number;
  name: string;
}

export interface KpiStrip {
  projects: number;
  owned: number;
  /** USD million. */
  ownedValue: number;
  /** (project, vertical) pairs in Enquiry generated or Quote sent. */
  openEnquiriesAndQuotes: number;
  /** Pairs in Order received whose activity date falls in the fiscal year. */
  ordersThisYear: number;
  unowned: number;
}

export interface SectorStageCell {
  sector: Sector;
  stage: Stage;
  count: number;
  value: number;
}

export interface ChaseRow {
  ref: string;
  name: string;
  stage: Stage;
  completionPct: number | null;
  value: number;
  city: City;
  type: string;
  overall: number;
  ownerVertical: number | null;
  ownerEngineer: Slug | null;
  /** The party that is the door in: the MEP consultant at specification stage, else the main contractor, else the lead consultant. */
  door: { kind: PartyKind; id: number; name: string } | null;
}

export interface VerticalSummary {
  slug: Slug;
  name: string;
  channel: Channel;
  engineers: number;
  owned: number;
  ownedValue: number;
  /** Bucket counts across every project for this vertical, in bucket order. */
  funnel: number[];
}

export interface EngineerSummary {
  slug: Slug;
  name: string;
  vertical: Slug;
  owned: number;
  ownedValue: number;
  /** Bucket counts for this engineer's owned projects on their vertical, in bucket order. */
  funnel: number[];
  /** Top five owned projects by value. */
  top: { ref: string; name: string; value: number; stage: Stage }[];
  consultants: number;
  contractors: number;
  /** Synthetic workload points: each owned project weighted by its activity band on this engineer's vertical (rules.ts WORKLOAD_WEIGHTS). */
  workload: number;
  /** The synthetic capacity every engineer is measured against, in the same points. */
  capacity: number;
  /** Workload as a percentage of capacity, one decimal. */
  loadPct: number;
  /** True when workload exceeds capacity. */
  overloaded: boolean;
}

export interface MatrixCellRollup {
  /** Projects of this row's type. */
  count: number;
  /** AED million. */
  value: number;
}

/** Per vertical, how far its relevance reaches across the matrix and the register. */
export interface VerticalReach {
  slug: Slug;
  name: string;
  rowsHigh: number;
  rowsMedium: number;
  rowsLow: number;
  rowsNone: number;
  /** Projects whose score on this vertical reads High, Medium, Low. */
  projectsHigh: number;
  projectsMedium: number;
  projectsLow: number;
  /** AED million of the projects graded High. */
  valueHigh: number;
}

export interface MatrixSummary {
  cellsGraded: number;
  cellsTotal: number;
  /** Projects whose overall relevance reads High. */
  projectsOverallHigh: number;
  valueOverallHigh: number;
  /** Projects with no vertical at or above the scope floor. */
  projectsBelowFloor: number;
  /** Projects carrying at least one hand-adjusted score. */
  projectsAdjusted: number;
  /** The vertical with the most High rows, and the type with the most High cells. */
  widestVertical: { slug: Slug; name: string; rowsHigh: number };
  topType: { type: string; industry: string; sector: Sector; cellsHigh: number; projects: number };
  reach: VerticalReach[];
}

export interface PartyRank {
  id: number;
  name: string;
  role: PartyRole;
  level: RelationshipLevel | null;
  rating: number | null;
  owner: Slug | null;
  projectCount: number;
  projectValue: number;
}

export interface PartyKindSummary {
  total: number;
  senior: number;
  middle: number;
  junior: number;
  /** Firms the group holds no relationship with (level, rating and owner all null). */
  noRelationship: number;
  /** AED million of projects those firms sit on. */
  noRelationshipValue: number;
  /** Mean rating to one decimal over the firms that have one. */
  averageRating: number;
  /** Firms on ten or more projects. */
  onTenPlus: number;
  /** Total AED million across the firms' project books (a project counts once per firm it sits on). */
  bookValue: number;
  /** The twenty largest firms by project value. The page derives every other ranking (by count, or on one vertical) from the party file itself. */
  top: PartyRank[];
}

/** One declared source-shape target and the register's measured figure against it, reconciled on every run. */
export interface ShapeCheck {
  key: string;
  label: string;
  /** The measured figure, in `unit`. */
  measured: number;
  lo: number;
  hi: number;
  unit: 'percent' | 'projects' | 'firms';
  /** Where the declared range comes from, in words. */
  basis: string;
  pass: boolean;
}

export interface PartySummary {
  consultants: PartyKindSummary;
  contractors: PartyKindSummary;
  /** Projects with no lead or MEP consultant recorded. */
  projectsNoConsultant: number;
  /** Projects with no main or MEP contractor recorded. */
  projectsNoContractor: number;
  /** Projects at Tender or early construction with no contractor: the ones still open to win. */
  openProjectsNoContractor: number;
}

export interface Meta {
  company: string;
  division: string;
  system: string;
  /** ISO date the register is stated as of. */
  dataAsOf: string;
  dataAsOfLabel: string;
  fiscalYear: number;
  currency: string;
  unit: string;
  seed: number;
  registerName: string;
}

export interface Definition {
  key: string;
  term: string;
  text: string;
}

export interface Rollup {
  meta: Meta;
  verticals: Vertical[];
  engineers: Engineer[];
  matrix: MatrixRow[];
  /** Per matrix row, projects of that type: count and value. */
  matrixRows: MatrixCellRollup[];
  /** Per vertical, the sum of matrix-row counts whose cell is High, Medium, Low. */
  shards: Shard[];
  kpis: KpiStrip;
  sectorStage: SectorStageCell[];
  chase: ChaseRow[];
  verticalSummary: VerticalSummary[];
  engineerSummary: EngineerSummary[];
  /** Bucket counts across all (project, vertical) pairs, in bucket order. */
  funnel: number[];
  /** Bucket counts across projects, counting each project once by its best bucket (lowest code). */
  funnelProjects: number[];
  parties: { consultants: number; contractors: number; owners: number };
  gradeScore: Record<Grade, number>;
  scopeFloor: number;
  buyingCompletionFloorPct: number;
  /** The synthetic capacity in workload points, and the weights per activity band. */
  engineerCapacity: number;
  workloadWeights: Record<'won' | 'active' | 'quiet' | 'closed', number>;
  definitions: Record<string, Definition>;
  precisionPolicy: string[];
  assumptions: string[];
  cascade: string[];
  bucketRule: string[];
  workloadRule: string[];
  relationshipRule: string[];
  /** Declared source-shape ranges and the measured figures, checked by the generator and re-checked by the reconciliation. */
  shape: ShapeCheck[];
  distributions: { stages: { stage: Stage; count: number }[]; sectors: { sector: Sector; count: number }[]; cities: { city: City; count: number }[] };
  matrixSummary: MatrixSummary;
  partySummary: PartySummary;
}

export interface Assertion {
  id: string;
  category: string;
  statement: string;
  left: number;
  right: number;
  pass: boolean;
}

export interface Reconciliation {
  policy: string[];
  categories: { name: string; checked: number; passed: number }[];
  assertions: Assertion[];
  passed: number;
  failed: number;
}

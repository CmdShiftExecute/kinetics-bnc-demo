/**
 * The one data contract every screen, the generator and the reconciliation read from.
 *
 * Money is AED million to one decimal. Percentages are plain numbers to one decimal
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

export interface OwnerWhy {
  /** Verticals at or above the scope floor, in vertical order (indexes). */
  eligible: number[];
  /** The stage gate that fired. */
  gate: OwnerGate;
  /** Verticals that passed the gate (indexes). Empty when unassigned. */
  candidates: number[];
  /** True when two or more candidates shared the top score and the tie rule decided. */
  tie: boolean;
}

/** One project of the market register. Party fields are ids into the party files. */
export interface Project {
  ref: string;
  name: string;
  stage: Stage;
  /** 0 to 100, one decimal; null unless under construction. */
  completionPct: number | null;
  /** ISO date, expected finish. */
  completionDate: string;
  /** AED million, one decimal. */
  value: number;
  city: City;
  sector: Sector;
  category: Category;
  industry: string;
  type: string;
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
  /** AED million, one decimal: the sum of the shard's project values. */
  value: number;
}

export type PartyKind = 'consultant' | 'contractor';
/** A consultant is Lead/Design, MEP, or both; a contractor is Main/EPC, MEP, or both. */
export type PartyRole = 'lead' | 'mep' | 'both';
export type RelationshipLevel = 'Junior management' | 'Middle management' | 'Senior management';

export interface Party {
  id: number;
  name: string;
  kind: PartyKind;
  role: PartyRole;
  /** Vertical indexes this party matters to: the verticals graded High or Medium on its projects, by count. */
  verticals: number[];
  level: RelationshipLevel;
  /** 1 to 10, whole. */
  rating: number;
  /** Relationship owner, an engineer slug. */
  owner: Slug;
  projectCount: number;
  /** AED million, one decimal. */
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
  /** AED million. */
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
}

export interface MatrixCellRollup {
  /** Projects of this row's type. */
  count: number;
  /** AED million. */
  value: number;
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
  definitions: Record<string, Definition>;
  precisionPolicy: string[];
  assumptions: string[];
  cascade: string[];
  bucketRule: string[];
  distributions: { stages: { stage: Stage; count: number }[]; sectors: { sector: Sector; count: number }[]; cities: { city: City; count: number }[] };
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

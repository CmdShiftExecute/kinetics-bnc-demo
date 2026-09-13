/**
 * The rules the register runs on, shared by the generator, the reconciliation script
 * and the browser, so all three compute the same answer from the same inputs.
 *
 * Nothing here draws a random number. Everything is a pure function of its arguments.
 */
import type { BucketCode, Channel, Grade, OwnerGate, OwnerWhy, Stage, TieRule } from './schema';

/* ---------- precision ---------- */

/** One decimal, rounded half away from zero, formed in tenths so no floating residue survives. */
export const r1 = (n: number): number => Math.round((n + Number.EPSILON) * 10) / 10;
/** Sum of one-decimal figures, carried in tenths. */
export const sum1 = (xs: number[]): number => xs.reduce((a, b) => a + Math.round(b * 10), 0) / 10;
/** Percent to one decimal from two figures, never from other percentages. */
export const pctOf = (a: number, b: number): number => (b === 0 ? 0 : r1((a / b) * 100));

/* ---------- the relevance grade scale ---------- */

export const GRADE_SCORE: Record<Grade, number> = { High: 8, Medium: 5, Low: 2 };

/** The grade a one-decimal score reads as: the nearest grade by value, so a hand-adjusted 6.6 reads Medium and 6.7 reads High. */
export function gradeOf(score: number | null): Grade | null {
  if (score == null) return null;
  if (score >= 6.5) return 'High';
  if (score >= 3.5) return 'Medium';
  return 'Low';
}

/* ---------- the ownership cascade ---------- */

/** A vertical is eligible for a project only at this score or above. */
export const SCOPE_FLOOR = 4;
/** Under construction at this completion or below is still a buying-stage project. */
export const BUYING_COMPLETION_FLOOR_PCT = 5;

export const SPEC_STAGES: readonly Stage[] = ['Concept', 'Design'];
export const BUY_STAGES: readonly Stage[] = ['Tender', 'Under Construction'];

/** The stage gate: which channel this project is open to right now. */
export function stageGate(stage: Stage, completionPct: number | null, contractorAppointed: boolean): OwnerGate {
  if (SPEC_STAGES.includes(stage)) return 'specification';
  if (stage === 'Tender') return 'buying';
  if (stage === 'Under Construction' && (completionPct ?? 0) <= BUYING_COMPLETION_FLOOR_PCT) return 'buying';
  /* under construction beyond the floor, or completed */
  return contractorAppointed ? 'appointed' : 'held';
}

/** Whether a vertical's channel passes a gate. */
export function channelPasses(channel: Channel, gate: OwnerGate): boolean {
  if (gate === 'specification') return channel === 'consultants' || channel === 'both';
  if (gate === 'buying' || gate === 'appointed') return channel === 'contractors' || channel === 'both';
  return false;
}

export interface CascadeInput {
  stage: Stage;
  completionPct: number | null;
  contractorAppointed: boolean;
  /** Ten scores in vertical order. */
  scores: (number | null)[];
  /** Channel per vertical, in vertical order. */
  channels: Channel[];
  /** Projects already assigned to each vertical, in vertical order (the tie-break). */
  assignedSoFar: number[];
}

export interface CascadeResult {
  vertical: number | null;
  why: OwnerWhy;
}

/**
 * Steps 1 to 3 and 5 of the cascade. Step 4 (which engineer within the vertical) needs
 * the engineers' running pipeline values and is applied by the caller with pickEngineer.
 */
export function cascade(input: CascadeInput): CascadeResult {
  const eligible: number[] = [];
  input.scores.forEach((s, i) => {
    if (s != null && s >= SCOPE_FLOOR) eligible.push(i);
  });
  const gate = stageGate(input.stage, input.completionPct, input.contractorAppointed);
  const candidates = eligible.filter((i) => channelPasses(input.channels[i]!, gate));
  if (candidates.length === 0) return { vertical: null, why: { eligible, gate: eligible.length === 0 ? 'none' : gate, candidates, tie: false, tied: [], assignedAtDecision: [], tieRule: null } };
  const top = Math.max(...candidates.map((i) => input.scores[i]!));
  const tied = candidates.filter((i) => input.scores[i] === top);
  let winner = tied[0]!;
  let tieRule: TieRule | null = null;
  if (tied.length > 1) {
    /* fewer projects already assigned wins; a dead heat goes to the earlier vertical in the published order */
    for (const i of tied) if (input.assignedSoFar[i]! < input.assignedSoFar[winner]!) winner = i;
    const counts = tied.map((i) => input.assignedSoFar[i]!);
    /* the decision record: "fewer" only when the winner's count is strictly below every other tied count; otherwise the published order decided among the equal-minimum set */
    tieRule = counts.filter((c) => c === input.assignedSoFar[winner]!).length === 1 ? 'fewer' : 'order';
  }
  return { vertical: winner, why: { eligible, gate, candidates, tie: tied.length > 1, tied: tied.length > 1 ? tied : [], assignedAtDecision: tied.length > 1 ? tied.map((i) => input.assignedSoFar[i]!) : [], tieRule } };
}

/** Step 4: the engineer on the vertical with the lowest current pipeline value; a dead heat goes to the earlier engineer in the roster. */
export function pickEngineer<E extends { slug: string }>(roster: E[], pipeline: Map<string, number>): E {
  let best = roster[0]!;
  for (const e of roster) if ((pipeline.get(e.slug) ?? 0) < (pipeline.get(best.slug) ?? 0)) best = e;
  return best;
}

/* ---------- the activity buckets ---------- */

export const ORDER_RECEIVED: BucketCode = 0;
export const QUOTE_SENT: BucketCode = 1;
export const ENQUIRY_GENERATED: BucketCode = 2;
export const PROJECT_CLOSED: BucketCode = 4;
export const NOT_YET_AWARDED: BucketCode = 9;
export const NO_UPDATE: BucketCode = 10;

/** A project's best bucket across its verticals: the lowest code, because the list is priority-ordered. */
export const bestBucket = (codes: BucketCode[]): BucketCode => codes.reduce((a, b) => (b < a ? b : a), NO_UPDATE);

/* ---------- the four activity bands, and the synthetic workload measure built on them ---------- */

export type BandKey = 'won' | 'active' | 'quiet' | 'closed';
/** The eleven buckets folded into four bands: won, active, waiting or quiet, closed. One source for the mix bars, the engineers chart and the workload rule. */
export const ACTIVITY_BANDS: { key: BandKey; label: string; codes: BucketCode[] }[] = [
  { key: 'won', label: 'Orders', codes: [0] },
  { key: 'active', label: 'Active', codes: [1, 2, 3, 5, 6] },
  { key: 'quiet', label: 'Waiting or quiet', codes: [7, 8, 9, 10] },
  { key: 'closed', label: 'Closed', codes: [4] },
];
export const bandOf = (code: BucketCode): BandKey => ACTIVITY_BANDS.find((b) => b.codes.includes(code))!.key;
/** Bucket counts folded into band counts, in ACTIVITY_BANDS order. */
export const bandCounts = (funnel: number[]): number[] => ACTIVITY_BANDS.map((b) => b.codes.reduce<number>((a, c) => a + (funnel[c] ?? 0), 0));

/**
 * Workload: a SYNTHETIC measure of how much attention an engineer's book demands. Each
 * owned project earns points by its activity band on the engineer's own vertical: a live
 * enquiry, quote, visit or follow-up costs the most, an order or a quiet project costs a
 * little, a closed project costs nothing. It is an illustration of the kind of rule a
 * capacity view needs, not a survey of anyone's working hours.
 */
export const WORKLOAD_WEIGHTS: Record<BandKey, number> = { won: 1, active: 3, quiet: 1, closed: 0 };
/** The capacity every engineer is measured against, in the same points. Chosen so a handful of the 24 books exceed it; published on the Data basis page. */
export const ENGINEER_CAPACITY = 320;
export const workloadOf = (funnel: number[]): number => bandCounts(funnel).reduce((a, n, i) => a + n * WORKLOAD_WEIGHTS[ACTIVITY_BANDS[i]!.key], 0);

/** The "worth chasing" rule: Tender or early construction, overall relevance at or above this, and no closed bucket. */
export const CHASE_RELEVANCE_FLOOR = 5;
export function worthChasing(stage: Stage, completionPct: number | null, overall: number | null, buckets: BucketCode[]): boolean {
  const early = stage === 'Tender' || (stage === 'Under Construction' && (completionPct ?? 0) <= BUYING_COMPLETION_FLOOR_PCT);
  return early && overall != null && overall >= CHASE_RELEVANCE_FLOOR && !buckets.includes(PROJECT_CLOSED);
}

/* ---------- words for the cascade, used by the drill page and the reconciliation ---------- */

export function gateWords(gate: OwnerGate): string {
  switch (gate) {
    case 'specification':
      return 'at Concept or Design, so the project is being specified and goes to a vertical that sells through consultants';
    case 'buying':
      return 'at Tender or under construction at 5.0 percent or less, so the project is buying and goes to a vertical that sells through contractors';
    case 'appointed':
      return 'past 5.0 percent complete or completed, but a contractor is appointed, so it goes to a vertical that sells through contractors';
    case 'held':
      return 'past 5.0 percent complete or completed with no contractor appointed, so it is held unassigned';
    case 'none':
      return 'below the scope floor of 4.0 on every vertical, so no vertical is eligible';
  }
}

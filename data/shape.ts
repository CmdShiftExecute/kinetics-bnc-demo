/**
 * Declared quality and demo-behaviour ranges for the register-backed demo. The generator measures every one
 * before it writes a file and refuses to write when a range fails; the reconciliation
 * re-measures them from the written files and publishes the table on the Data basis page.
 *
 * Edit a range here, never in the generator, so the target and the check cannot drift apart.
 * Source-field fill ranges are intentionally broad enough to detect an import regression,
 * while internal-layer ranges keep the management views useful for the demonstration.
 */
import type { ShapeCheck } from './schema';

export type ShapeTarget = Omit<ShapeCheck, 'measured' | 'pass'>;

export const SHAPE_TARGETS: ShapeTarget[] = [
  { key: 'ownedShare', label: 'Projects assigned in the demo layer', lo: 88, hi: 96, unit: 'percent', basis: 'Operating check: the internal ownership cascade should leave a visible but limited unassigned cohort' },
  { key: 'smallestBook', label: 'Smallest engineer book', lo: 20, hi: 100, unit: 'projects', basis: 'Operating check: every fictional engineer should have a useful drill-down book' },
  { key: 'largestBook', label: 'Largest engineer book', lo: 700, hi: 1200, unit: 'projects', basis: 'Operating check: the authentic project mix is allowed to concentrate in a high-relevance vertical' },
  { key: 'quietShare', label: 'No update plus Waiting or follow up, share of pairs', lo: 40, hi: 60, unit: 'percent', basis: 'Illustrative activity layer: about half of project-vertical pairs are quiet or awaiting follow-up' },
  { key: 'ordersShare', label: 'Order received, share of pairs', lo: 0, hi: 5, unit: 'percent', basis: 'Illustrative activity layer: orders remain a small minority of all project-vertical pairs' },
  { key: 'closedShare', label: 'Project closed, share of pairs', lo: 6, hi: 14, unit: 'percent', basis: 'Illustrative activity layer: about a tenth of project-vertical pairs are closed' },
  { key: 'mepConsultantFill', label: 'Register rows with an MEP consultant', lo: 25, hi: 35, unit: 'percent', basis: 'Import regression guard for the supplied workbooks' },
  { key: 'mainContractorFill', label: 'Register rows with an appointed main or EPC contractor', lo: 32, hi: 45, unit: 'percent', basis: 'Import regression guard after treating “Not Yet Awarded” and “See Sub-Projects” as absent, not as company names' },
  { key: 'mepContractorFill', label: 'Register rows with an MEP contractor', lo: 20, hi: 32, unit: 'percent', basis: 'Import regression guard for the supplied workbooks' },
  { key: 'consultantMedian', label: 'Consultant source-label book, median', lo: 1, hi: 2, unit: 'projects', basis: 'Source company cells are preserved intact; many labels occur on one project' },
  { key: 'consultantMax', label: 'Consultant source-label book, largest', lo: 70, hi: 120, unit: 'projects', basis: 'Import regression guard for the most frequently repeated genuine consultant label' },
  { key: 'contractorMedian', label: 'Contractor source-label book, median', lo: 1, hi: 2, unit: 'projects', basis: 'Source company cells are preserved intact; many labels occur on one project' },
  { key: 'contractorMax', label: 'Contractor source-label book, largest', lo: 10, hi: 30, unit: 'projects', basis: 'Import regression guard for the most frequently repeated genuine contractor label after placeholders are excluded' },
  { key: 'noRelationshipShare', label: 'Firms with no relationship yet, share of firms', lo: 8, hi: 25, unit: 'percent', basis: 'Synthetic control cohort, so the "where do we have no relationship" question has a real answer' },
];

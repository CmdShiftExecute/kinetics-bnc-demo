/**
 * The declared source-shape targets: the magnitudes the synthetic register is meant to
 * resemble, each as a range with its basis in words. The generator measures every one
 * before it writes a file and refuses to write when a range fails; the reconciliation
 * re-measures them from the written files and publishes the table on the Data basis page.
 *
 * Edit a range here, never in the generator, so the target and the check cannot drift apart.
 * Every basis below is a shape from the build mandate, never a figure from a real workbook.
 */
import type { ShapeCheck } from './schema';

export type ShapeTarget = Omit<ShapeCheck, 'measured' | 'pass'>;

export const SHAPE_TARGETS: ShapeTarget[] = [
  { key: 'ownedShare', label: 'Projects owned, share of the register', lo: 78, hi: 88, unit: 'percent', basis: 'Source shape: 2,605 of 3,183 projects assigned, 81.8 percent' },
  { key: 'smallestBook', label: 'Smallest engineer book', lo: 15, hi: 50, unit: 'projects', basis: 'Source shape: 20, across 22 engineers; Halvard has 24' },
  { key: 'largestBook', label: 'Largest engineer book', lo: 430, hi: 600, unit: 'projects', basis: 'Source shape: 536' },
  { key: 'quietShare', label: 'No update plus Waiting or follow up, share of pairs', lo: 40, hi: 60, unit: 'percent', basis: 'Source shape: about half' },
  { key: 'ordersShare', label: 'Order received, share of pairs', lo: 0, hi: 5, unit: 'percent', basis: 'Source shape: under 5 percent' },
  { key: 'closedShare', label: 'Project closed, share of pairs', lo: 6, hi: 14, unit: 'percent', basis: 'Source shape: about a tenth' },
  { key: 'mepConsultantFill', label: 'Rows with an MEP consultant', lo: 20, hi: 28, unit: 'percent', basis: 'Source shape: about 24 percent' },
  { key: 'mainContractorFill', label: 'Rows with a main or EPC contractor', lo: 62, hi: 82, unit: 'percent', basis: 'Source shape: about 80 percent; held lower at completed stages so the ownership cascade leaves the source share unassigned' },
  { key: 'mepContractorFill', label: 'Rows with an MEP contractor', lo: 14, hi: 24, unit: 'percent', basis: 'Source shape: about 19 percent' },
  { key: 'consultantMedian', label: 'Consultant book, median projects', lo: 3, hi: 6, unit: 'projects', basis: 'About 900 consultants over 3,500 projects with at most two lead and one MEP consultant each is about 4,500 links, so a median of 3 to 4 follows by arithmetic; the source median of 11 counts a firm once per engineer workbook before dedup and is not comparable' },
  { key: 'consultantMax', label: 'Consultant book, largest', lo: 80, hi: 140, unit: 'projects', basis: 'Source shape: 4 to 120' },
  { key: 'contractorMedian', label: 'Contractor book, median projects', lo: 3, hi: 6, unit: 'projects', basis: 'Source shape: median 4' },
  { key: 'contractorMax', label: 'Contractor book, largest', lo: 18, hi: 30, unit: 'projects', basis: 'Source shape: 2 to 25' },
  { key: 'noRelationshipShare', label: 'Firms with no relationship yet, share of firms', lo: 8, hi: 25, unit: 'percent', basis: 'Synthetic control cohort, so the "where do we have no relationship" question has a real answer' },
];

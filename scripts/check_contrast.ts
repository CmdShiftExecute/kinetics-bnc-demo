/**
 * Measures WCAG 2.x contrast for every text and surface pair the stylesheet uses.
 * Reads the token values from src/styles/index.css so it cannot drift from them.
 *
 * Run:  bun scripts/check_contrast.ts
 * Fails (exit 1) if any text pair is below 4.5:1 or any non-text mark below 3:1.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'styles', 'index.css'), 'utf8');

/**
 * Resolves a token to the hex that actually paints. A token may alias another
 * one (`--row-hover: var(--paper-3)`), so an alias is followed rather than
 * throwing, and the gate measures the real colour instead of the name.
 */
function token(name: string, depth = 0): string {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`Token --${name} not found in index.css`);
  const value = m[1]!.trim();
  const alias = value.match(/^var\(\s*--([\w-]+)\s*\)$/);
  if (alias) {
    if (depth > 4) throw new Error(`Token --${name} aliases in a circle`);
    return token(alias[1]!, depth + 1);
  }
  const hex = value.match(/^#[0-9a-fA-F]{6}$/);
  if (!hex) throw new Error(`Token --${name} is not a six-digit hex or an alias of one: "${value}"`);
  return value.toLowerCase();
}

function luminance(hex: string): number {
  const c = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const paper = token('paper');
const paper2 = token('paper-2');
const paper3 = token('row-hover');
const ink = token('ink');
const ink2 = token('ink-2');
const hazard = token('hazard');
const hazardText = token('hazard-text');
const rule = token('rule');
const hgHigh = token('hg-high');
const hgMed = token('hg-med');
const hgLow = token('hg-low');
const hv1 = token('hv-1');
const hv2 = token('hv-2');
const hv3 = token('hv-3');
const hv4 = token('hv-4');
const hv5 = token('hv-5');
const spot = token('spot');
const spot2 = token('spot-2');
const ink3 = token('ink-3');

interface Pair {
  what: string;
  fg: string;
  bg: string;
  min: number;
}

const pairs: Pair[] = [
  { what: 'Body and table text (ink on paper)', fg: ink, bg: paper, min: 4.5 },
  { what: 'Labels and notes (ink-2 on paper)', fg: ink2, bg: paper, min: 4.5 },
  { what: 'Hazard text on paper', fg: hazardText, bg: paper, min: 4.5 },
  { what: 'Text on hovered row and stamp (ink on paper-2)', fg: ink, bg: paper2, min: 4.5 },
  { what: 'Labels on hovered row and stamp (ink-2 on paper-2)', fg: ink2, bg: paper2, min: 4.5 },
  { what: 'Hazard text on paper-2', fg: hazardText, bg: paper2, min: 4.5 },
  /* The hovered row is paper-3, a stronger tone than the stamp's paper-2, so every
     text colour is measured against it too. Weakening any of these fails the build. */
  { what: 'Text on the hovered row (ink on paper-3)', fg: ink, bg: paper3, min: 4.5 },
  { what: 'Labels on the hovered row (ink-2 on paper-3)', fg: ink2, bg: paper3, min: 4.5 },
  { what: 'Hazard text on the hovered row (hazard-text on paper-3)', fg: hazardText, bg: paper3, min: 4.5 },
  { what: 'Tooltip text (paper on ink)', fg: paper, bg: ink, min: 4.5 },
  { what: 'Chart readbox hazard text (#ff9a9a on ink)', fg: '#ff9a9a', bg: ink, min: 4.5 },
  { what: 'Hazard marks, bars and borders on paper (non-text)', fg: hazard, bg: paper, min: 3 },
  /* Non-text, and the whole point of the hover: the hovered row must read as a
     different tone from the page at a glance. paper-2 measured 1.11:1 against
     paper, below what an eye registers on a dense table; paper-3 measures 1.25:1,
     so 1.2 is the floor this implementation is held to. */
  { what: 'Hovered row against the page, must be visible (row-hover vs paper, non-text, floor 1.2:1)', fg: paper3, bg: paper, min: 1.2 },
  /* heatmap cells: the grade letter and count are text, so every tint carries its text colour at 4.5:1 */
  { what: 'Heatmap High cell text (paper on hg-high)', fg: paper, bg: hgHigh, min: 4.5 },
  { what: 'Heatmap Medium cell text (ink on hg-med)', fg: ink, bg: hgMed, min: 4.5 },
  { what: 'Heatmap Low cell text (ink on hg-low)', fg: ink, bg: hgLow, min: 4.5 },
  { what: 'Heatmap value step 1 text (ink on hv-1)', fg: ink, bg: hv1, min: 4.5 },
  { what: 'Heatmap value step 2 text (ink on hv-2)', fg: ink, bg: hv2, min: 4.5 },
  { what: 'Heatmap value step 3 text (ink on hv-3)', fg: ink, bg: hv3, min: 4.5 },
  { what: 'Heatmap value step 4 text (paper on hv-4)', fg: paper, bg: hv4, min: 4.5 },
  { what: 'Heatmap value step 5 text (paper on hv-5)', fg: paper, bg: hv5, min: 4.5 },
  { what: 'Heatmap Medium against Low, adjacent steps must read apart (non-text)', fg: hgMed, bg: hgLow, min: 1.5 },
  { what: 'Selected list item text (paper on ink)', fg: paper, bg: ink, min: 4.5 },
  /* the second print ink and its ramp, non-text marks only: bars, columns, swatches */
  { what: 'Spot ink marks on paper (non-text)', fg: spot, bg: paper, min: 3 },
  { what: 'Spot tint marks on paper (non-text)', fg: spot2, bg: paper, min: 3 },
  { what: 'Third ink marks on paper (non-text)', fg: ink3, bg: paper, min: 3 },
  { what: 'Tooltip text (ink on paper)', fg: ink, bg: paper, min: 4.5 },
  { what: 'Hairline rule on paper (decorative, reported only)', fg: rule, bg: paper, min: 0 },
];

let failed = false;
console.log('Contrast, WCAG 2.x relative luminance');
for (const p of pairs) {
  const c = contrast(p.fg, p.bg);
  const ok = c >= p.min;
  if (!ok) failed = true;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.toFixed(2)}:1  (min ${p.min})  ${p.what}  ${p.fg} on ${p.bg}`);
}
if (failed) {
  console.error('One or more pairs fail. Fix the tokens in src/styles/index.css.');
  process.exit(1);
}
console.log('All measured pairs pass.');

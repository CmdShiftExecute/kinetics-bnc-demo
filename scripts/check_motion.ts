/**
 * Source gate for chart entry motion: an in-view trigger may live only on an HTML
 * element. `whileInView` is Motion's IntersectionObserver, and WebKit reports an
 * SVG target once and then never again (w3c/IntersectionObserver#376), so a
 * `whileInView` on a <g>, <rect>, <circle> or <path> leaves the mark at its
 * collapsed entry state for ever on an iPhone. Measured on his phone, 16 Sep 2026:
 * three charts drew their labels and figures and no marks. Charts take their
 * trigger from the wrapper div through `useChartEntry` in ChartMotion.ts instead.
 *
 * Run:  bun scripts/check_motion.ts        exit 1 on any offender.
 * The gate first proves itself on a planted offender, so a scan that finds
 * nothing is a scan that looked.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const SVG_TAGS = /motion\.(svg|g|rect|circle|ellipse|path|line|polyline|polygon|text|tspan|use)\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : [];
  });
}

/** The reasons one file's source is an offender, or none. */
function offences(file: string, source: string): string[] {
  const out: string[] = [];
  /* comments may name the trap; only code is judged */
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const name = basename(file);
  if (text.includes('GROUP_IN_VIEW')) out.push('uses the retired GROUP_IN_VIEW trigger');
  if (text.includes('whileInView')) {
    if (name !== 'Reveal.tsx') out.push('puts whileInView outside Reveal.tsx (the HTML reveal)');
    if (SVG_TAGS.test(text)) out.push('puts whileInView in a file that renders SVG motion elements');
  }
  return out;
}

const planted = offences('Donut.tsx', '<motion.rect whileInView={{ scaleX: 1 }} />');
if (planted.length === 0) {
  console.error('FAIL  check_motion cannot see a planted whileInView on an SVG mark; the gate is broken');
  process.exit(1);
}
console.log(`PASS  check_motion reports a planted offender (negative control: ${planted.join('; ')})`);

let files = 0;
const bad: string[] = [];
for (const f of walk(src)) {
  files++;
  for (const why of offences(f, readFileSync(f, 'utf8'))) bad.push(`${relative(root, f)}: ${why}`);
}
for (const b of bad) console.log(`FAIL  ${b}`);
if (bad.length) {
  console.error(`\n${bad.length} in-view trigger(s) on SVG. Charts take their entry from the wrapper through useChartEntry.`);
  process.exit(1);
}
console.log(`PASS  ${files} source files: every in-view trigger sits on an HTML element`);

/**
 * Reference tooling for the published register.
 *
 *   bun run refs:restore   rewrite public/data to carry the REAL source references (local only)
 *   bun run refs:mask      the exact inverse; returns the tree byte-identical
 *   bun run refs:check     exit 1 if any real source reference appears in a published surface
 *
 * restore and mask are textual, token-exact replacements of quoted JSON scalars, so a string
 * value and an object key are both covered and the file's own formatting is untouched. Both are
 * idempotent: a second run finds nothing to replace.
 *
 * The map lives at .private/ref-map.json, written by scripts/generate_demo_data.ts. It is
 * gitignored, so a public clone can never restore anything; this local copy can, with no
 * workbook and no external file.
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICTIONAL_REF_RE, REAL_REF_RE, type RefMapFile } from './ref_mask';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'public', 'data');
const mapPath = join(root, '.private', 'ref-map.json');

const MISSING_MAP = [
  `No reference map at ${relative(root, mapPath)}.`,
  'It is private and is never committed. Rebuild it from the private source with:',
  '    bun run data',
  '(which reads .private/bnc-source.json and rewrites the map and the published register together).',
].join('\n');

function loadMap(): RefMapFile {
  if (!existsSync(mapPath)) {
    console.error(MISSING_MAP);
    process.exit(1);
  }
  return JSON.parse(readFileSync(mapPath, 'utf8')) as RefMapFile;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Replace every quoted JSON token found in `lookup`. Returns the new body and a count. */
function swap(body: string, pattern: RegExp, lookup: Map<string, string>): { body: string; n: number } {
  let n = 0;
  const next = body.replace(pattern, (whole, token: string) => {
    const to = lookup.get(token);
    if (to === undefined) return whole;
    n++;
    return `"${to}"`;
  });
  return { body: next, n };
}

function rewrite(direction: 'restore' | 'mask') {
  const file = loadMap();
  const lookup = new Map<string, string>();
  for (const [fictional, real] of Object.entries(file.map)) {
    if (direction === 'restore') lookup.set(fictional, real);
    else lookup.set(real, fictional);
  }
  const pattern = direction === 'restore' ? /"([A-Z]{2}[A-HJ-NP-Z2-9]{7})"/g : /"(PRJ[A-Z]{2}\d+)"/g;

  let total = 0;
  for (const full of walk(dataDir).filter((f) => f.endsWith('.json')).sort()) {
    const body = readFileSync(full, 'utf8');
    const { body: next, n } = swap(body, pattern, lookup);
    if (n > 0) writeFileSync(full, next);
    total += n;
    console.log(`${String(n).padStart(6)}  ${relative(root, full)}`);
  }
  console.log(`refs ${direction}: ${total} replacement(s) across ${walk(dataDir).filter((f) => f.endsWith('.json')).length} file(s)`);
}

/** Every surface a reader of the public repository can see. */
function checkTargets(): { label: string; namesOnly: boolean; paths: string[] }[] {
  const dirs: { dir: string; namesOnly: boolean }[] = [
    { dir: join(root, 'public'), namesOnly: false },
    { dir: join(root, 'src'), namesOnly: false },
    { dir: join(root, 'docs'), namesOnly: false },
    { dir: join(root, 'screenshots'), namesOnly: true },
  ];
  const out = dirs
    .filter((d) => existsSync(d.dir))
    .map((d) => ({ label: relative(root, d.dir), namesOnly: d.namesOnly, paths: walk(d.dir) }));
  for (const f of ['README.md', 'index.html']) {
    if (existsSync(join(root, f))) out.push({ label: f, namesOnly: false, paths: [join(root, f)] });
  }
  return out;
}

const BINARY = /\.(png|jpe?g|gif|webp|woff2?|ttf|eot|ico|pdf|zip)$/i;

function check() {
  const hits: string[] = [];
  let scanned = 0;
  for (const target of checkTargets()) {
    for (const full of target.paths) {
      const rel = relative(root, full);
      scanned++;
      if (REAL_REF_RE.test(rel)) hits.push(`${rel}: real reference in the file name`);
      if (target.namesOnly || BINARY.test(full)) continue;
      const lines = readFileSync(full, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = new RegExp(REAL_REF_RE.source).exec(lines[i]!);
        if (m) {
          hits.push(`${rel}:${i + 1}: ${m[0]}`);
          break;
        }
      }
    }
  }
  if (hits.length) {
    console.error('refs:check FAILED - real source references are visible in the published tree:');
    for (const h of hits.slice(0, 20)) console.error(`    ${h}`);
    if (hits.length > 20) console.error(`    ... and ${hits.length - 20} more`);
    process.exit(1);
  }
  console.log(`refs:check clean (${scanned} files across public, src, docs, screenshots, README.md, index.html)`);
}

const cmd = process.argv[2];
if (cmd === 'restore' || cmd === 'mask') rewrite(cmd);
else if (cmd === 'check') check();
else {
  console.error('usage: bun scripts/refs.ts <restore|mask|check>');
  process.exit(2);
}

/* Keep the shared shape constant referenced so a change to the mask format breaks here too. */
void FICTIONAL_REF_RE;

/**
 * Byte-stability gate: the generator and the reconciliation must write identical files
 * on every run, so `bun run check` never dirties the tree and a diff in public/data is
 * always a real change. Hashes every published file, re-runs both scripts, hashes again.
 *
 * Run:  bun scripts/check_stable.ts
 * Exit 1 if any file differs, is added or is removed between the two runs.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'public', 'data');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
function snapshot(): Map<string, string> {
  return new Map(walk(dataDir).map((p) => [relative(dataDir, p), createHash('sha256').update(readFileSync(p)).digest('hex')]));
}
function run(script: string) {
  const r = Bun.spawnSync(['bun', join(here, script)], { cwd: root, stdout: 'pipe', stderr: 'pipe' });
  if (r.exitCode !== 0) {
    console.error(r.stderr.toString());
    throw new Error(`${script} exited ${r.exitCode}`);
  }
}

const before = snapshot();
run('generate_demo_data.ts');
run('reconcile.ts');
const after = snapshot();
const names = new Set([...before.keys(), ...after.keys()]);
const diffs = [...names].filter((n) => before.get(n) !== after.get(n)).sort();
if (diffs.length) {
  console.error(`NOT byte-stable: ${diffs.length} file(s) changed between two runs:`);
  for (const d of diffs) console.error(`  ${d}`);
  process.exit(1);
}
console.log(`Byte-stable: ${after.size} published files identical across two runs.`);

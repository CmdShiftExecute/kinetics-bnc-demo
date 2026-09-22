/**
 * Copies the verticals and the 24 engineers (slug, name, vertical) from the
 * MIS demo's published index into data/verticals.json and data/engineers.json, so this
 * demo names the same people and verticals as the MIS without anyone retyping them.
 *
 * Run:  bun scripts/import_verticals.ts [--from <path to the MIS public/data/index.json>]
 * Out:  data/verticals.json, data/engineers.json (committed; the generator reads them)
 *
 * A one-shot import, not a build-time dependency: this repo stays self-contained once the
 * files are written. Re-run it only if the MIS roster changes. No timestamp is written.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const i = args.indexOf('--from');
// Default: a sibling checkout of the MIS demo beside this one. Override with --from.
const from = i >= 0 && args[i + 1] ? args[i + 1]! : join(here, '..', '..', 'kinetics-mis-demo', 'public', 'data', 'index.json');

interface Entry {
  slug: string;
  name: string;
  engineers: { slug: string; name: string }[];
}
const raw = JSON.parse(readFileSync(from, 'utf8')) as unknown;
if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${from} is not a non-empty array`);
const entries = raw.map((v): Entry => {
  const o = v as Partial<Entry>;
  if (typeof o.slug !== 'string' || typeof o.name !== 'string' || !Array.isArray(o.engineers)) throw new Error('index entry without slug, name and engineers');
  for (const e of o.engineers) if (typeof e.slug !== 'string' || typeof e.name !== 'string') throw new Error(`engineer without slug and name under ${o.slug}`);
  return { slug: o.slug, name: o.name, engineers: o.engineers.map((e) => ({ slug: e.slug, name: e.name })) };
});
const verticals = entries.map((e) => ({ slug: e.slug, name: e.name }));
const engineers = entries.flatMap((e) => e.engineers.map((g) => ({ slug: g.slug, name: g.name, vertical: e.slug })));
writeFileSync(join(here, '..', 'data', 'verticals.json'), JSON.stringify({ source: 'kinetics-mis-demo public/data/index.json', verticals }, null, 1) + '\n');
writeFileSync(join(here, '..', 'data', 'engineers.json'), JSON.stringify({ source: 'kinetics-mis-demo public/data/index.json', engineers }, null, 1) + '\n');
console.log(`Wrote ${verticals.length} verticals and ${engineers.length} engineers`);

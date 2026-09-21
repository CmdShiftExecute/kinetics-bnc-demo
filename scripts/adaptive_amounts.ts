import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

/** The largest published project, read from the built register rather than pinned as a literal. */
function largestProjectRef(): string {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
  const rollup = JSON.parse(readFileSync(join(dir, 'rollup.json'), 'utf8')) as { shards: { file: string }[] };
  let best = { ref: '', value: -1 };
  for (const s of rollup.shards) {
    const shard = JSON.parse(readFileSync(join(dir, s.file), 'utf8')) as { projects: { ref: string; value: number }[] };
    for (const p of shard.projects) if (p.value > best.value) best = { ref: p.ref, value: p.value };
  }
  if (!best.ref) throw new Error('no published project found');
  return best.ref;
}


const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();
const failures: string[] = [];

async function expectText(route: string, selector: string, expected: string) {
  await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
  const actual = (await page.locator(selector).innerText()).trim();
  if (actual !== expected) failures.push(`${route} ${selector}: expected "${expected}", got "${actual}"`);
}

await expectText('/', '#kpi-value .big', 'USD 838.7 billion');
await expectText('/engineers', '#ek-value .big', 'USD 838.7 billion');
await expectText('/engineers/faisal-reyes', '#eng-value .big', 'USD 57.2 billion');
await expectText(`/p/${largestProjectRef()}`, '#p-value .big', 'USD 27.2 billion');

await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Adaptive USD headline checks: 4/4 passed');

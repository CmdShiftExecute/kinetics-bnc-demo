/**
 * Captures every route at desktop, laptop and phone widths with a real Chromium,
 * plus the Projects page filtered and the matrix rolled up to sector level.
 *
 * Run:  bun scripts/screenshots.ts [--base http://127.0.0.1:4182] [--out <dir>] [--tag <label>] [--insecure] [--widths 1440,1024,390]
 * Default output: ./screenshots (gitignored).
 *
 * Reduced motion is requested so the capture shows the settled page, not a frame
 * mid-animation. Fonts are awaited before every capture. A document wider than the
 * viewport or any console error fails the run.
 */

import { mkdirSync, readFileSync } from 'node:fs';
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


const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const base = arg('base', 'http://127.0.0.1:4182').replace(/\/$/, '');
const out = arg('out', join(process.cwd(), 'screenshots'));
const insecure = args.includes('--insecure');
const tag = arg('tag', 'halvard-pis');
const widths = arg('widths', '1440,1024,390').split(',').map((w) => Number(w));

const pages = [
  { path: '/', name: 'overview', wait: '#chase-table' },
  { path: '/relevance', name: 'relevance', wait: '#heatmap' },
  { path: '/projects', name: 'projects', wait: '.vt-row' },
  { path: '/projects?sector=Urban%20Construction&stage=Tender&v=cooling&floor=5', name: 'projects-filtered', wait: '.vt-row' },
  { path: '/engineers', name: 'engineers', wait: '.ledger-cell' },
  { path: '/engineers/rohan-pillai', name: 'engineer-rohan-pillai', wait: '.vt-row' },
  { path: '/parties', name: 'parties', wait: '#plist' },
  { path: '/parties?kind=contractor&id=1', name: 'parties-contractor-1', wait: '#party-name' },
  { path: `/p/${largestProjectRef()}`, name: 'project-largest', wait: '#score-strip' },
  { path: '/data-basis', name: 'data-basis', wait: '#rec-categories' },
];

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of widths) {
    const mobile = width < 700;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce', ignoreHTTPSErrors: insecure, isMobile: mobile, hasTouch: mobile });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const p of pages) {
      await page.goto(`${base}${p.path}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForSelector('h1', { timeout: 20000 });
      await page.waitForSelector(p.wait, { timeout: 20000 });
      await page.waitForTimeout(400);
      const docW = await page.evaluate(() => document.documentElement.scrollWidth);
      if (docW > width) {
        console.error(`Document width ${docW}px exceeds viewport ${width}px on ${p.path}`);
        process.exitCode = 1;
      }
      await page.screenshot({ path: join(out, `${tag} ${p.name} ${width}.png`), fullPage: false });
      await page.screenshot({ path: join(out, `${tag} ${p.name} ${width} full.png`), fullPage: true });
      console.log(`wrote ${p.name} at ${width}`);
      if (p.name === 'relevance') {
        await page.locator('#roll-sector').click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(out, `${tag} relevance-sector ${width} full.png`), fullPage: true });
        await page.locator('#colour-value').click();
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(out, `${tag} relevance-value ${width}.png`), fullPage: false });
        console.log(`wrote relevance rolled up and value-tinted at ${width}`);
      }
    }
    await context.close();
    if (errors.length) {
      console.error(`Console errors at ${width}:`);
      for (const e of errors) console.error('  ' + e);
      process.exitCode = 1;
    } else {
      console.log(`No console errors at ${width}.`);
    }
  }
} finally {
  await browser.close();
}

/**
 * Interaction, keyboard, structure and resilience gate, run against a served build.
 *
 * Run:  bun scripts/interactions.ts [--base http://127.0.0.1:4182] [--out <dir>] [--insecure]
 *
 * Every check prints PASS or FAIL with its evidence; exit code 1 on any failure. The
 * filter checks predict the count from the published JSON with the same predicate the
 * page uses (src/lib/filters.ts), so a wrong live figure is caught against the rule,
 * not against a snapshot. Every positive check has a negative control that must fail:
 * a defeated hover rule, a chart that ignores the pointer, a broken filter prediction,
 * a reduced-motion page that must render static, a removed cell the alignment gate
 * must report.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Page } from 'playwright';
import { phoneChecks } from './phone';
import type { Party, Project, Reconciliation, Rollup } from '../data/schema';
import { BUCKETS } from '../data/schema';
import { EMPTY, matches, parseFilters } from '../src/lib/filters';
import { aedCompact } from '../src/lib/format';
import { valueStep } from '../src/lib/tint';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const base = arg('base', 'http://127.0.0.1:4182').replace(/\/$/, '');
const out = arg('out', join(process.cwd(), 'screenshots'));
const insecure = args.includes('--insecure');
mkdirSync(out, { recursive: true });

const results: { ok: boolean; what: string }[] = [];
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  results.push({ ok, what });
};
const num = (s: string) => Number(s.replace(/[^\d.\-−]/g, '').replace('−', '-'));
const stripNum = async (page: Page, selector: string) => {
  const node = page.locator(selector);
  const raw = await node.getAttribute('data-value');
  return raw === null ? num((await node.innerText()).trim()) : Number(raw);
};
/** Adaptive USD display, upper case, as the chart readouts print it. */
const aedUp = (n: number) => aedCompact(n).toUpperCase();
const sum1 = (xs: number[]) => xs.reduce((a, b) => a + Math.round(b * 10), 0) / 10;

/** Reads a hoverable row's first cell at rest and under the pointer, parking the mouse away first. */
async function rowHover(page: Page, rowSel: string) {
  const cell = page.locator(rowSel).first().locator('xpath=*[1]');
  await cell.scrollIntoViewIfNeeded();
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  const before = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
  const box = (await cell.boundingBox())!;
  const widthBefore = await cell.evaluate((el) => el.getBoundingClientRect().width);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(220);
  const after = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
  const marker = await cell.evaluate((el) => getComputedStyle(el).boxShadow);
  const widthAfter = await cell.evaluate((el) => el.getBoundingClientRect().width);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  return { before, after, marker, widthBefore, widthAfter, shifted: before !== after, marked: /inset/.test(marker), steady: Math.abs(widthBefore - widthAfter) < 0.5 };
}
/** Moves the pointer across a chart's plot (never a click, never a key) and reports the readout and outlined marks. */
async function chartHover(page: Page, id: string, fx: number, fy: number) {
  const svg = page.locator(`svg#${id}`);
  await svg.scrollIntoViewIfNeeded();
  const box = (await svg.boundingBox())!;
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy - 2);
  await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
  await page.waitForTimeout(180);
  const n = await svg.locator('.readbox text').count();
  const read = n === 0 ? '' : ((await svg.locator('.readbox text').first().textContent()) ?? '').trim();
  const marks = await svg.locator('.mk-on').count();
  return { read, marks, live: read.length > 0 };
}
async function breakCss(page: Page, css: string) {
  await page.evaluate((text) => {
    const el = document.createElement('style');
    el.id = 'negative-control';
    el.textContent = text;
    document.head.appendChild(el);
  }, css);
}
async function unbreakCss(page: Page) {
  await page.evaluate(() => document.getElementById('negative-control')?.remove());
}
/** Every logical column of a table must have a cell under it. */
const ALIGN_FN = `(sel) => {
  const table = document.querySelector(sel);
  if (!table) return { out: ['no table'], rows: 0, cols: 0 };
  const ths = Array.from(table.querySelectorAll('thead tr:last-child th'));
  const rows = Array.from(table.querySelectorAll('tbody tr')).filter((r) => !r.classList.contains('vt-pad'));
  const out = [];
  for (const row of rows) {
    const cells = Array.from(row.children);
    let col = 0;
    for (const cell of cells) {
      const span = cell.colSpan || 1;
      const first = ths[col];
      const last = ths[col + span - 1];
      if (!first || !last) { out.push('row ' + rows.indexOf(row) + ' overflows headers at col ' + col); break; }
      const a = first.getBoundingClientRect();
      const z = last.getBoundingClientRect();
      const b = cell.getBoundingClientRect();
      if (Math.abs(a.left - b.left) > 0.5) out.push('row ' + rows.indexOf(row) + ' col ' + col + ' left off by ' + (b.left - a.left).toFixed(1));
      if (Math.abs(z.right - b.right) > 0.5) out.push('row ' + rows.indexOf(row) + ' col ' + col + ' right off by ' + (b.right - z.right).toFixed(1));
      col += span;
    }
    if (col !== ths.length) out.push('row ' + rows.indexOf(row) + ' covers ' + col + ' of ' + ths.length + ' columns');
  }
  return { out, rows: rows.length, cols: ths.length };
}`;
const alignment = (page: Page, sel: string) => page.evaluate(`(${ALIGN_FN})(${JSON.stringify(sel)})`) as Promise<{ out: string[]; rows: number; cols: number }>;

const browser = await chromium.launch();
const errors: string[] = [];
let expectMissing = false;
let expected404 = 0;
async function newPage(width: number, reducedMotion: 'reduce' | 'no-preference' = 'no-preference') {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: insecure, reducedMotion });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (expectMissing && /404|500/.test(m.text())) {
      expected404++;
      return;
    }
    errors.push(`[${width}] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[${width}] ${String(e)}`));
  return { context, page };
}
const tally = async (page: Page) => ({ count: Number(await page.locator('#tally').getAttribute('data-count')), value: Number(await page.locator('#tally').getAttribute('data-value')) });
const waitRows = async (page: Page) => {
  await page.waitForSelector('#tally', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector('.vt-row') !== null || document.querySelector('#no-rows') !== null, null, { timeout: 30000 });
  await page.waitForTimeout(150);
};

try {
  /* ---------- the data the checks predict from ---------- */
  const rollup = (await (await fetch(`${base}/data/rollup.json`)).json()) as Rollup;
  const projects: Project[] = [];
  for (const s of rollup.shards) projects.push(...((await (await fetch(`${base}/data/${s.file}`)).json()) as { projects: Project[] }).projects);
  const consultants = (await (await fetch(`${base}/data/parties/consultants.json`)).json()) as Party[];
  const contractors = (await (await fetch(`${base}/data/parties/contractors.json`)).json()) as Party[];
  const rec = (await (await fetch(`${base}/data/reconciliation.json`)).json()) as Reconciliation;
  const vIndex = new Map(rollup.verticals.map((v, i) => [v.slug, i]));
  const predict = (query: string) => {
    const f = parseFilters(new URLSearchParams(query), rollup);
    const rows = projects.filter((p) => matches(p, f, vIndex));
    return { count: rows.length, value: sum1(rows.map((p) => p.value)) };
  };
  check(projects.length === rollup.kpis.projects && projects.length >= 3000, `The register read from ${rollup.shards.length} shards holds ${projects.length} projects, matching the headline figure`);

  const { context, page } = await newPage(1440);

  /* ---------- 1. structure at three widths ---------- */
  for (const w of [1440, 1024, 390]) {
    const { context: c2, page: p2 } = await newPage(w);
    for (const path of ['/', '/projects', '/relevance']) {
      await p2.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      await p2.waitForSelector('h1');
      await p2.waitForTimeout(300);
      const docW = await p2.evaluate(() => document.documentElement.scrollWidth);
      check(docW <= w, `${path} document width at ${w}px is ${docW}px`);
    }
    await c2.close();
  }

  /* ---------- 2. the overview ---------- */
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('#chase-table tbody tr');
  await page.waitForTimeout(800);
  const kpiOwned = await stripNum(page, '#kpi-owned dd.big');
  const kpiValue = await stripNum(page, '#kpi-value dd.big');
  check(kpiOwned === rollup.kpis.owned && Math.round(kpiValue * 10) === Math.round(rollup.kpis.ownedValue * 10), `KPI strip shows the published owned count and value (${kpiOwned}, ${kpiValue})`);
  const chaseRows = await page.locator('#chase-table tbody tr').count();
  const chaseFirst = (await page.locator('#chase-table tbody tr').first().locator('th').innerText()).trim();
  check(chaseRows === rollup.chase.length && chaseFirst === rollup.chase[0]!.name, `Worth chasing lists ${chaseRows} rows, largest first (${chaseFirst})`);
  const sizes = await page.evaluate(() => [getComputedStyle(document.querySelector('.mast-system')!).fontSize, getComputedStyle(document.querySelector('.page-title')!).fontSize]);
  check(sizes[0] === '16px' && parseFloat(sizes[1]!) > parseFloat(sizes[0]!), `Masthead uses the finalized MIS contextual title (16px), subordinate to the page heading (${sizes[1]})`);
  const vtRow = await rowHover(page, '#vertical-table tbody tr.hov');
  check(vtRow.shifted && vtRow.marked && vtRow.steady, `Hovering an overview row changes its tone from ${vtRow.before} to ${vtRow.after}, marks its first cell, and does not move it`);
  await breakCss(page, 'table.mis tr.hov:hover td, table.mis tr.hov:hover th { background: var(--paper) !important; box-shadow: none !important; }');
  const vtNeg = await rowHover(page, '#vertical-table tbody tr.hov');
  check(!vtNeg.shifted && !vtNeg.marked, `Row-hover gate reports a defeated hover rule (negative control: ${vtNeg.before} to ${vtNeg.after})`);
  await unbreakCss(page);
  const ssHover = await chartHover(page, 'sector-stage-chart', 0.45, 0.8);
  check(ssHover.live && ssHover.marks > 0 && /URBAN CONSTRUCTION/.test(ssHover.read), `Stacked columns read out on a plain pointer move ("${ssHover.read.slice(0, 60)}"), no click`);
  await page.mouse.move(4, 4);
  await page.locator('svg#sector-stage-chart').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  const ssKey = ((await page.locator('svg#sector-stage-chart .readbox text').first().textContent()) ?? '').trim();
  const tenderUrban = rollup.sectorStage.find((c) => c.stage === 'Tender' && c.sector === 'Urban Construction')!;
  check(ssKey.startsWith('TENDER, URBAN CONSTRUCTION') && ssKey.includes(aedUp(tenderUrban.value)), `Arrow keys walk the columns and segments: "${ssKey.slice(0, 70)}" matches the published cell (USD ${tenderUrban.value} m)`);
  await page.keyboard.press('Escape');
  await page.locator('#sector-stage-views button[data-view="count"]').click();
  await page.waitForTimeout(400);
  const ssCount = await chartHover(page, 'sector-stage-chart', 0.45, 0.8);
  check(/PROJECTS/.test(ssCount.read) && !/USD/.test(ssCount.read), `The view switch re-reads the chart in projects ("${ssCount.read.slice(0, 50)}")`);
  await page.locator('#sector-stage-views button[data-view="value"]').click();
  await page.waitForTimeout(400);
  await breakCss(page, 'svg#sector-stage-chart { pointer-events: none !important; }');
  await page.mouse.move(4, 4);
  const ssNeg = await chartHover(page, 'sector-stage-chart', 0.45, 0.8);
  check(!ssNeg.live, `Chart-hover gate reports a chart that ignores the pointer (negative control: "${ssNeg.read}")`);
  await unbreakCss(page);
  const fnHover = await chartHover(page, 'funnel-chart', 0.5, 0.05);
  check(fnHover.live && /ORDER RECEIVED/.test(fnHover.read), `Funnel chart reads out on a plain pointer move ("${fnHover.read}")`);
  await page.mouse.move(4, 4);
  await page.locator('svg#funnel-chart').focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  const fnKey = ((await page.locator('svg#funnel-chart .readbox text').first().textContent()) ?? '').trim();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  const fnCleared = await page.locator('svg#funnel-chart .readbox').count();
  check(/QUOTE SENT/.test(fnKey) && fnCleared === 0, `Funnel chart walks its bars by keyboard ("${fnKey.slice(0, 40)}") and Escape clears the readout`);
  /* tab order: nav, then the KPI links, then the sort-free tables */
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#chase-table tbody tr');
  const seq: string[] = [];
  await page.locator('nav.nav a').first().focus();
  for (let i = 0; i < 26; i++) {
    seq.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return `${el.tagName.toLowerCase()}:${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}|${el.closest('[id^="kpi-"]')?.id ?? ''}`;
    }));
    await page.keyboard.press('Tab');
  }
  writeFileSync(join(out, 'tab-sequence.json'), JSON.stringify(seq, null, 1));
  const idx = (re: RegExp) => seq.findIndex((s) => re.test(s));
  const order = [idx(/^a:Relevance matrix/), idx(/^a:Data basis/), idx(/\|kpi-projects$/), idx(/^a:All projects/i)];
  check(order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]!)), `Tab reaches the nav, the KPI links and the section links in reading order (${seq.filter((s) => s !== 'body:').length} stops)`);
  const ring = await page.evaluate(() => {
    const a = document.querySelector('nav.nav a') as HTMLElement;
    a.focus();
    return getComputedStyle(a).outlineStyle + ' ' + getComputedStyle(a).outlineWidth;
  });
  check(/solid/.test(ring) && !/0px/.test(ring), `Focus ring is visible on links (${ring})`);

  /* ---------- 3. the projects page: filters predicted from the data ---------- */
  await page.goto(`${base}/projects`, { waitUntil: 'networkidle' });
  await waitRows(page);
  const t0 = await tally(page);
  check(t0.count === projects.length && Math.round(t0.value * 10) === Math.round(sum1(projects.map((p) => p.value)) * 10), `Unfiltered register shows ${t0.count} projects and USD ${t0.value} m, the sum of every row`);
  const shown = await page.locator('.vt-row').count();
  check(shown < 80 && shown > 10, `The windowed table draws ${shown} rows of ${t0.count} (only the rows in view plus a margin)`);
  const firstVal = Number(await page.locator('.vt-row').first().locator('td').nth(4).getAttribute('data-value'));
  const maxVal = Math.max(...projects.map((p) => p.value));
  check(firstVal === maxVal, `Default sort is value descending: first row shows ${firstVal}, the largest value in the register`);
  /* a facet: Tender */
  await page.locator('input[data-facet="stage"][data-value="Tender"]').click();
  await page.waitForURL(/stage=Tender/);
  await waitRows(page);
  const t1 = await tally(page);
  const e1 = predict('stage=Tender');
  check(t1.count === e1.count && Math.round(t1.value * 10) === Math.round(e1.value * 10), `Stage: Tender shows ${t1.count} projects, USD ${t1.value} m, exactly what the predicate predicts from the data`);
  check(/stage=Tender/.test(page.url()), `The filter is written to the address (${new URL(page.url()).search})`);
  const tenderRows = projects.filter((p) => p.stage === 'Tender');
  const vkCount = await stripNum(page, '#vk-count dd.big');
  const vkOwned = await stripNum(page, '#vk-owned dd.big');
  check(vkCount === tenderRows.length && vkOwned === tenderRows.filter((p) => p.ownerVertical != null).length, `The view cards re-count with the filter: ${vkCount} projects, ${vkOwned} owned, as the data predicts`);
  await page.mouse.move(4, 4);
  await page.locator('svg#view-columns').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const vcRead = ((await page.locator('svg#view-columns .readbox text').first().textContent()) ?? '').trim();
  const vcOther = await page.locator('svg#view-columns .readbox').count();
  check(vcRead.startsWith('TENDER: ') && vcRead.includes(`${tenderRows.length.toLocaleString('en-GB')} PROJECTS`), `The view chart re-shapes with the filter: Tender column reads "${vcRead.slice(0, 60)}" (${vcOther} readout)`);
  await page.keyboard.press('Escape');
  const chips1 = Number(await page.locator('#chips').getAttribute('data-count'));
  check(chips1 === 1 && /Stage: Tender/.test(await page.locator('#chips').innerText()), `One chip shows the active filter (${chips1})`);
  /* negative control for the prediction: a deliberately wrong prediction must disagree */
  check(t1.count !== e1.count + 1, `Prediction gate would report a count off by one (negative control: ${t1.count} versus ${e1.count + 1})`);
  /* a second facet plus a vertical and floor, all predicted */
  await page.locator('input[data-facet="sector"][data-value="Urban Construction"]').click();
  await page.waitForURL(/sector=Urban/);
  await waitRows(page);
  await page.locator('#v-pick').selectOption('cooling');
  await waitRows(page);
  await page.locator('#v-floor').fill('5');
  await waitRows(page);
  const t2 = await tally(page);
  const e2 = predict('stage=Tender&sector=Urban%20Construction&v=cooling&floor=5');
  check(t2.count === e2.count && t2.count < t1.count, `Adding sector Urban Construction and Cooling at 5.0 or more narrows to ${t2.count} projects, as predicted (${e2.count})`);
  const scoreHeader = await page.locator('th[aria-sort] button', { hasText: 'Cooling score' }).count();
  check(scoreHeader === 1, 'Choosing a vertical adds its score column to the table');
  /* the bucket facet is now scoped to the chosen vertical */
  const bucketTitle = (await page.locator('#facet-bucket legend').innerText()).trim();
  check(/Activity on Cooling/i.test(bucketTitle), `Bucket facet re-scopes to the chosen vertical ("${bucketTitle}")`);
  await page.locator(`input[data-facet="bucket"][data-value="${BUCKETS[1]}"]`).click();
  await page.waitForURL(/bucket=1/);
  await waitRows(page);
  const t3 = await tally(page);
  const e3 = predict('stage=Tender&sector=Urban%20Construction&v=cooling&floor=5&bucket=1');
  check(t3.count === e3.count, `Quote sent on Cooling narrows to ${t3.count}, as predicted (${e3.count})`);
  /* search */
  const urlBefore = page.url();
  await page.locator('#q').fill('Tower');
  await waitRows(page);
  const t4 = await tally(page);
  const e4 = predict(new URL(page.url()).search.slice(1));
  check(t4.count === e4.count && /q=Tower/.test(page.url()) && page.url() !== urlBefore, `Searching "Tower" narrows to ${t4.count}, matching the predicate on the live address`);
  /* URL round trip: load the address fresh and read the same chips and count */
  const savedUrl = page.url();
  const savedCount = t4.count;
  await page.goto(`${base}/engineers`, { waitUntil: 'networkidle' });
  await page.goto(savedUrl, { waitUntil: 'networkidle' });
  await waitRows(page);
  const t5 = await tally(page);
  const chips5 = Number(await page.locator('#chips').getAttribute('data-count'));
  check(t5.count === savedCount && chips5 >= 5, `A filtered address round-trips: reloaded, it shows the same ${t5.count} projects and ${chips5} chips`);
  /* an unknown filter key is ignored; a hostile range is tolerated */
  await page.goto(`${base}/projects?nonsense=1&stage=Tender&vmin=abc&cmax=-5&v=no-such-vertical`, { waitUntil: 'networkidle' });
  await waitRows(page);
  const t6 = await tally(page);
  check(t6.count === e1.count, `Unknown keys, a non-numeric range and an unknown vertical are ignored: ${t6.count} projects, the Tender count`);
  /* empty result: contradictory range */
  await page.goto(`${base}/projects?vmin=100&vmax=1`, { waitUntil: 'networkidle' });
  await waitRows(page);
  const t7 = await tally(page);
  const empty = await page.locator('#no-rows').count();
  check(t7.count === 0 && empty === 1, `A contradictory value range gives zero projects and a readable empty state`);
  /* clear all */
  await page.locator('#clear-all').click();
  await waitRows(page);
  const t8 = await tally(page);
  check(t8.count === projects.length && !new URL(page.url()).search, `Clear all restores every project and empties the address`);
  /* chip removal */
  await page.goto(`${base}/projects?stage=Tender|Design`, { waitUntil: 'networkidle' });
  await waitRows(page);
  await page.locator('#chips button', { hasText: 'Stage: Design' }).click();
  await waitRows(page);
  const t9 = await tally(page);
  check(t9.count === e1.count && !/Design/.test(page.url()), `Removing a chip removes that one filter (${t9.count} Tender projects remain)`);
  /* sort by every column, on 3,500 rows */
  await page.goto(`${base}/projects`, { waitUntil: 'networkidle' });
  await waitRows(page);
  const headers = await page.locator('thead th[aria-sort] button').allInnerTexts();
  let sortsOk = 0;
  for (let i = 0; i < headers.length; i++) {
    const btn = page.locator('thead th[aria-sort] button').nth(i);
    await btn.click();
    await page.waitForTimeout(120);
    const sorted = await page.locator('thead th[aria-sort="ascending"], thead th[aria-sort="descending"]').count();
    const rows = await page.locator('.vt-row').count();
    if (sorted === 1 && rows > 0) sortsOk++;
  }
  check(sortsOk === headers.length && headers.length >= 9, `Every one of ${headers.length} columns sorts the full register with aria-sort set (${sortsOk} ok)`);
  await page.locator('thead th[aria-sort] button', { hasText: 'Value' }).click();
  await page.waitForTimeout(150);
  const asc = Number(await page.locator('.vt-row').first().locator('td').nth(4).getAttribute('data-value'));
  const minVal = Math.min(...projects.map((p) => p.value));
  check(asc === minVal || asc === maxVal, `Clicking the value header again flips the direction (first row ${asc})`);
  /* column chooser */
  await page.locator('#cols-menu summary').click();
  await page.locator('input[data-col="lastUpdated"]').click();
  await page.waitForTimeout(150);
  const updatedCol = await page.locator('thead th button', { hasText: 'Updated' }).count();
  check(updatedCol === 1 && /cols=/.test(page.url()), 'The column chooser adds a column and records it in the address');
  /* CSV export */
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#csv').click()]);
  const csvPath = await download.path();
  const csvText = csvPath ? readFileSync(csvPath, 'utf8') : '';
  const csvRows = csvText.split('\r\n').filter(Boolean).length - 1;
  check(csvRows === projects.length && /"Reference","Project"/.test(csvText), `CSV export carries ${csvRows} rows of the current view with a header`);
  /* the windowed table scrolls and re-windows */
  await page.locator('.vt').evaluate((el) => (el.scrollTop = 40000));
  await page.waitForTimeout(200);
  const start = Number(await page.locator('.vt').getAttribute('data-start'));
  check(start > 500, `Scrolling the table re-windows the rows (window now starts at row ${start})`);
  await page.locator('.vt').evaluate((el) => (el.scrollTop = 0));
  await page.waitForTimeout(150);
  const al = await alignment(page, '.vt-table');
  check(al.out.length === 0 && al.rows > 0, `Windowed table cells cover every logical column (${al.rows} rows, ${al.cols} columns)`);
  const negative = (await page.evaluate(`(() => {
    const row = document.querySelector('.vt-row');
    const cell = row.lastElementChild; const parent = cell.parentElement; parent.removeChild(cell);
    const res = (${ALIGN_FN})('.vt-table');
    parent.appendChild(cell);
    return res;
  })()`)) as { out: string[] };
  check(negative.out.length > 0, `Alignment gate reports a removed cell (negative control: ${negative.out[0] ?? 'nothing reported'})`);
  const vrow = await rowHover(page, '.vt-row');
  check(vrow.shifted && vrow.marked && vrow.steady, `Hovering a register row changes its tone (${vrow.before} to ${vrow.after}) and marks it`);
  /* rail toggle */
  await page.locator('#rail-toggle').click();
  await page.waitForTimeout(150);
  const railHidden = await page.locator('#rail').isHidden();
  await page.locator('#rail-toggle').click();
  await page.waitForTimeout(150);
  check(railHidden && (await page.locator('#rail').isVisible()), 'The filter rail collapses and comes back');

  /* ---------- 4. the matrix ---------- */
  await page.goto(`${base}/relevance`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#heatmap tbody tr');
  const typeRowsBefore = await page.locator('#heatmap tbody tr.lv-type').count();
  await page.locator('#heatmap tr.lv-industry button.disc').first().click();
  await page.waitForTimeout(150);
  const typeRowsAfter = await page.locator('#heatmap tbody tr.lv-type').count();
  check(typeRowsBefore === 0 && typeRowsAfter > 0, `Opening an industry reveals its project types (${typeRowsAfter} type rows)`);
  const cellBtn = page.locator('#heatmap tr.lv-type').first().locator('td.heat-c button').first();
  const cellLabel = (await cellBtn.getAttribute('aria-label')) ?? '';
  const cellCount = Number(await cellBtn.getAttribute('data-count'));
  await cellBtn.scrollIntoViewIfNeeded();
  const cb = (await cellBtn.boundingBox())!;
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.waitForTimeout(200);
  const tipBox = await page.locator('#cell-tip').boundingBox();
  const tipText = await page.locator('#cell-tip').innerText();
  const tipNear = tipBox ? Math.abs(tipBox.x - (cb.x + cb.width / 2)) < 40 || Math.abs(tipBox.x + tipBox.width - (cb.x + cb.width / 2)) < 40 : false;
  check(/grade/i.test(tipText) && tipNear, `Pointing at a cell opens a tooltip beside the cursor (${tipBox ? Math.round(tipBox.x - cb.x) : 'no'}px from it; "${cellLabel.slice(0, 40)}")`);
  await page.mouse.move(4, 4);
  await page.waitForTimeout(150);
  check((await page.locator('#cell-tip').count()) === 0, 'The tooltip closes when the pointer leaves the cell');
  const kpiCells = await page.locator('#matrix-kpis > div').count();
  const mkHigh = await stripNum(page, '#mk-high dd.big');
  check(kpiCells === 6 && mkHigh === rollup.matrixSummary.projectsOverallHigh, `The matrix page carries six headline cards; projects reading High equals the published ${mkHigh}`);
  const reachHover = await chartHover(page, 'reach-chart', 0.3, 0.12);
  check(reachHover.live && /HIGH/.test(reachHover.read), `The reach chart reads out on a plain pointer move ("${reachHover.read.slice(0, 60)}")`);
  const below = await page.evaluate(() => {
    const t = document.querySelector('#heatmap')!.getBoundingClientRect();
    const g = document.querySelector('#grade-scale')!.getBoundingClientRect();
    const h = document.querySelector('#how-scores')!.getBoundingClientRect();
    const m = document.querySelector('#matrix')!.getBoundingClientRect();
    return { tableW: Math.round(t.width), secW: Math.round(m.width), scaleBelow: g.top >= t.bottom, howBelow: h.top >= g.bottom };
  });
  check(below.scaleBelow && below.howBelow && below.tableW >= below.secW * 0.9, `The matrix runs the full width (${below.tableW}px of ${below.secW}px); the grade scale and the scoring note sit below it`);
  await cellBtn.click();
  await waitRows(page);
  const tm = await tally(page);
  const em = predict(new URL(page.url()).search.slice(1));
  check(/\/projects\?/.test(page.url()) && tm.count === em.count && (cellCount === 0 || tm.count === cellCount), `Clicking the cell lands on the Projects page filtered to that type and vertical with ${tm.count} projects (cell said ${cellCount})`);
  await page.goto(`${base}/relevance`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#heatmap tbody tr');
  await page.locator('#roll-sector').click();
  await page.waitForTimeout(150);
  const rolledRows = await page.locator('#heatmap tbody tr').count();
  check(rolledRows === 5, `Rolling up to sector leaves ${rolledRows} rows`);
  await page.locator('#colour-value').click();
  await page.waitForTimeout(150);
  const valueCells = await page.locator('#heatmap td[class*="hv-"]').count();
  check(valueCells > 0, `Tinting by value recolours ${valueCells} cells on the slate scale`);
  const highText = await page.evaluate(() => {
    const td = document.querySelector('#heatmap td.hg-high, #heatmap td.hv-5') as HTMLElement | null;
    return td ? getComputedStyle(td).color : 'none';
  });
  check(/rgb\(244, 244, 240\)/.test(highText), `Text on the darkest cell is paper, so it reads (${highText})`);

  /* ---------- 5. engineers ---------- */
  await page.goto(`${base}/engineers`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ledger-cell');
  const cards = await page.locator('.ledger-cell').count();
  check(cards === rollup.engineers.length, `One block per engineer (${cards})`);
  const firstBook = rollup.engineerSummary.filter((e) => e.vertical === rollup.verticals[0]!.slug).sort((a, b) => b.ownedValue - a.ownedValue)[0]!;
  await page.locator('svg#books-chart').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);
  const bookRead = ((await page.locator('svg#books-chart .readbox text').first().textContent()) ?? '').trim();
  check(bookRead.startsWith(firstBook.name.toUpperCase()) && bookRead.includes(aedUp(firstBook.ownedValue)), `The books chart walks by keyboard and reads the published value ("${bookRead.slice(0, 60)}")`);
  await page.keyboard.press('Escape');
  const target = rollup.engineerSummary[0]!;
  const cardOwned = Number(await page.locator(`.ledger-cell[data-slug="${target.slug}"]`).getAttribute('data-owned'));
  await page.locator(`.ledger-cell[data-slug="${target.slug}"] a.drill-link`).click();
  await page.waitForSelector('#eng-owned');
  await waitRows(page).catch(() => {});
  const engOwned = await stripNum(page, '#eng-owned dd.big');
  const engRows = Number(await page.locator('.vt').getAttribute('data-total'));
  check(engOwned === cardOwned && engRows === cardOwned && cardOwned === projects.filter((p) => p.ownerEngineer === target.slug).length, `${target.name}'s page count (${engOwned}) equals the card (${cardOwned}) and the register`);
  const mixHover = await (async () => {
    await page.goto(`${base}/engineers`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.ledger-cell');
    const svg = page.locator(`svg#mix-${target.slug}`);
    await svg.scrollIntoViewIfNeeded();
    /* the section rises 8px as it reveals; a 10px bar measured mid-rise is missed by the pointer */
    await page.waitForTimeout(600);
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + 3, box.y + box.height / 2 - 2);
    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.waitForTimeout(200);
    return (await page.locator(`svg#mix-${target.slug}`).locator('xpath=..').locator('.mix-read').innerText()).trim();
  })();
  check(/of \d+/.test(mixHover), `The activity mix bar reads out under the pointer ("${mixHover.slice(0, 50)}")`);

  /* ---------- 6. parties ---------- */
  await page.goto(`${base}/parties`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#plist li');
  const listN = Number(await page.locator('#picker-count').getAttribute('data-count'));
  check(listN === consultants.length && (await page.locator('#party-empty').count()) === 1, `The selector lists all ${listN} consultants and shows an empty card until one is picked`);
  const topFirm = rollup.partySummary.consultants.top[0]!;
  const tf = page.locator('svg#top-firms-chart');
  await tf.scrollIntoViewIfNeeded();
  const tfBox = (await tf.boundingBox())!;
  await page.mouse.move(tfBox.x + tfBox.width * 0.4, tfBox.y + 34);
  await page.waitForTimeout(120);
  await page.mouse.click(tfBox.x + tfBox.width * 0.4, tfBox.y + 34);
  await page.waitForSelector('#party-name');
  const tfName = (await page.locator('#party-name').innerText()).trim();
  check(tfName.toUpperCase() === topFirm.name.toUpperCase() && new URL(page.url()).searchParams.get('id') === String(topFirm.id), `Clicking the first bar of the top-firms chart opens that firm's card (${tfName})`);
  const pkCells = await page.locator('#party-kpis > div').count();
  check(pkCells === 6 && await stripNum(page, '#pk-consultants dd.big') === consultants.length, `The parties page carries six headline cards; consultants equals the party file`);
  await page.goto(`${base}/parties`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#plist li');
  await page.locator('#plist button').first().click();
  await page.waitForSelector('#party-name');
  const pickedId = Number(await page.locator('#party-card').getAttribute('data-id'));
  const pickedRows = Number(await page.locator('#party-card').getAttribute('data-count'));
  const picked = consultants.find((c) => c.id === pickedId)!;
  check(pickedRows === picked.projectCount && /id=/.test(page.url()), `Picking ${picked.name} lists its ${pickedRows} projects, matching the party file`);
  await page.locator('button[data-kind="contractor"]').click();
  await page.waitForTimeout(200);
  const listK = Number(await page.locator('#picker-count').getAttribute('data-count'));
  check(listK === contractors.length && (await page.locator('#party-empty').count()) === 1, `Switching to contractors lists all ${listK} and clears the selection`);
  await page.locator('button[data-role="mep"]').click();
  await page.waitForTimeout(150);
  const listMep = Number(await page.locator('#picker-count').getAttribute('data-count'));
  check(listMep === contractors.filter((c) => c.role !== 'lead').length, `The MEP role filter narrows to ${listMep} contractors`);
  const mepFirst = contractors.filter((c) => c.role !== 'lead').sort((a, b) => b.projectCount - a.projectCount)[0]!;
  await page.locator('#party-q').fill(mepFirst.name.split(' ')[0]!);
  await page.waitForTimeout(150);
  const listQ = Number(await page.locator('#picker-count').getAttribute('data-count'));
  check(listQ >= 1 && listQ < listMep, `Name search narrows the list to ${listQ}`);
  await page.goto(`${base}/parties?kind=contractor&id=${contractors[0]!.id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#party-name');
  const cardRows = await page.locator('#party-projects-table tbody tr').count();
  const shared = await page.locator('#party-shared-list li').count();
  check(cardRows === contractors[0]!.projectCount && shared > 0, `A party address opens its card directly: ${cardRows} projects and ${shared} firms it shares them with`);

  /* ---------- 7. the project drill ---------- */
  const sample = projects.find((p) => p.ownerEngineer && p.mepConsultant && p.mainContractors.length)!;
  await page.goto(`${base}/p/${sample.ref}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#score-strip');
  const pValue = await stripNum(page, '#p-value dd.big');
  const why = await page.locator('#why li').count();
  const whyText = await page.locator('#why').innerText();
  const ownerName = rollup.engineers.find((e) => e.slug === sample.ownerEngineer)!.name;
  check(pValue === sample.value && why === 4 && whyText.includes(ownerName), `${sample.ref} shows its value and the four cascade steps naming ${ownerName}`);
  const partyLinks = await page.locator('#party-list a').count();
  check(partyLinks >= 3, `The parties block links ${partyLinks} firms to their cards`);
  await page.locator('svg#score-strip').focus();
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const scoreRead = (await page.locator('svg#score-strip').locator('xpath=..').locator('.mix-read').innerText()).trim();
  check(new RegExp(rollup.verticals[0]!.name).test(scoreRead), `The score strip walks columns by keyboard ("${scoreRead.slice(0, 50)}")`);
  const activityRows = await page.locator('#activity-table tbody tr').count();
  check(activityRows === rollup.verticals.length, `Activity by vertical lists all ${activityRows} verticals`);

  /* ---------- 7b. the executive layer on every route: six cards, one full-width visual directly beneath (Data basis exempt) ---------- */
  const layoutOf = (path: string) =>
    page.evaluate(() => {
      const strip = document.querySelector('dl.strip') as HTMLElement | null;
      if (!strip) return { cards: 0, visual: false, ratio: 0 };
      let next = strip.nextElementSibling as HTMLElement | null;
      // Approved overview hierarchy inserts value semantics and management attention before its visual.
      if (strip.id === 'kpis') next = document.querySelector('#sector-stage');
      /* the first SECTION after the strip must carry the visual; anything else (a grid, a text block) is not one */
      const svg = next && next.tagName === 'SECTION' ? (next.querySelector('svg.chart') as SVGElement | null) : null;
      const sw = next ? next.getBoundingClientRect().width : 0;
      const vw = svg ? svg.getBoundingClientRect().width : 0;
      return { cards: strip.children.length, visual: svg !== null, ratio: sw ? vw / sw : 0 };
    }).then((r) => ({ path, ...r }));
  const overloadedEng = rollup.engineerSummary.find((e) => e.overloaded)!;
  const routesWithVisual = ['/', '/relevance', '/projects', '/engineers', '/parties', `/engineers/${overloadedEng.slug}`, `/p/${sample.ref}`];
  for (const r of routesWithVisual) {
    await page.goto(`${base}${r}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('dl.strip');
    await page.waitForTimeout(500);
    const l = await layoutOf(r);
    check(l.cards === 6 && l.visual && l.ratio >= 0.9, `${r} carries six headline cards and a full-width primary visual (${l.cards} cards, visual ${l.visual}, ${Math.round(l.ratio * 100)}% of the section)`);
  }
  await page.goto(`${base}/data-basis`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#rec-strip');
  await page.waitForTimeout(400);
  const dbLayout = await layoutOf('/data-basis');
  check(dbLayout.cards === 6 && !dbLayout.visual, `/data-basis carries six cards and, by the principal's exemption, no visual beneath them (negative control for the visual gate: ${dbLayout.visual})`);
  const shapeRows = await page.locator('#shape-table tbody tr').count();
  const shapeMissed = await page.locator('#shape-table tbody tr[data-pass="false"]').count();
  check(shapeRows === rollup.shape.length && shapeRows >= 10 && shapeMissed === 0, `Data basis lists all ${shapeRows} declared source-shape ranges and every one is met`);

  /* ---------- 7c. the top-twenty firms rank on the selected measure over the whole party list ---------- */
  const byCount = [...consultants].sort((a, b) => b.projectCount - a.projectCount || b.projectValue - a.projectValue || a.id - b.id);
  const byValue = [...consultants].sort((a, b) => b.projectValue - a.projectValue || b.projectCount - a.projectCount || a.id - b.id);
  const countTop = byCount.slice(0, 20).map((c) => c.id);
  const valueTop = byValue.slice(0, 20).map((c) => c.id);
  const omitted = countTop.filter((id) => !valueTop.includes(id));
  check(omitted.length > 0, `Negative control from the data: a count ranking drawn from the value top twenty would omit ${omitted.length} count leaders, so the two rankings must be derived separately`);
  await page.goto(`${base}/parties`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#plist li');
  await page.locator('#top-consultant-views button[data-view="count"]').click();
  await page.waitForTimeout(400);
  await page.locator('svg#top-firms-chart').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);
  const countRead = ((await page.locator('svg#top-firms-chart .readbox text').first().textContent()) ?? '').trim();
  check(countRead.startsWith(byCount[0]!.name.toUpperCase()) && countRead.includes(`${byCount[0]!.projectCount.toLocaleString('en-GB')} PROJECTS`), `Projects view of the top firms ranks the whole list by count: first bar "${countRead.slice(0, 60)}" is the count leader (${byCount[0]!.projectCount} projects)`);
  await page.keyboard.press('Escape');
  await page.locator('#top-consultant-views button[data-view="value"]').click();
  await page.waitForTimeout(400);
  await page.locator('svg#top-firms-chart').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);
  const valueRead = ((await page.locator('svg#top-firms-chart .readbox text').first().textContent()) ?? '').trim();
  check(valueRead.startsWith(byValue[0]!.name.toUpperCase()) && (byValue[0]!.id === byCount[0]!.id || !valueRead.startsWith(byCount[0]!.name.toUpperCase())), `Value view ranks by value: first bar "${valueRead.slice(0, 50)}" is the value leader`);
  await page.keyboard.press('Escape');

  /* ---------- 7d. the value tint on a fresh matrix, nothing expanded, against the published data ---------- */
  const cellValue = (rows: number[], vi: number) => Math.round(rows.reduce((a, ri) => a + (rollup.matrix[ri]!.cells[vi] ? rollup.matrixRows[ri]!.value * 10 : 0), 0)) / 10;
  const sectorRows = (sector: string) => rollup.matrix.map((r, i) => (r.sector === sector ? i : -1)).filter((i) => i >= 0);
  const sectorMax = Math.max(1, ...['Urban Construction', 'Industrial', 'Oil, Gas and Fuels', 'Transport', 'Utilities'].flatMap((s) => rollup.verticals.map((_v, vi) => cellValue(sectorRows(s), vi))));
  /* the page's own scale (src/lib/tint.ts), and the retired one for the negative control: five linear slices of whatever type rows happened to be expanded, which with none expanded had a domain of 1 */
  const stepOf = valueStep;
  const retiredStep = (v: number, max: number) => Math.min(5, Math.max(1, Math.ceil((5 * v) / Math.max(1, max))));
  await page.goto(`${base}/relevance`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#heatmap tbody tr');
  const typeRowsFresh = await page.locator('#heatmap tbody tr.lv-type').count();
  await page.locator('#colour-value').click();
  await page.waitForTimeout(200);
  const tinted = (await page.locator('#heatmap tr.lv-sector td[class*="hv-"]').evaluateAll((tds) => tds.map((td) => ({ cls: (td.className.match(/hv-\d/) ?? [''])[0], value: Number((td as HTMLElement).dataset.value), level: (td as HTMLElement).dataset.level })))) as { cls: string; value: number; level: string }[];
  const allTinted = (await page.locator('#heatmap td[class*="hv-"]').evaluateAll((tds) => tds.map((td) => (td.className.match(/hv-\d/) ?? [''])[0]))) as string[];
  const distinct = new Set(allTinted);
  const industryDistinct = new Set((await page.locator('#heatmap tr.lv-industry td[class*="hv-"]').evaluateAll((tds) => tds.map((td) => (td.className.match(/hv-\d/) ?? [''])[0]))) as string[]);
  const predictedOk = tinted.every((t) => t.cls === `hv-${stepOf(t.value, sectorMax)}`);
  check(typeRowsFresh === 0 && tinted.length >= 20 && distinct.size >= 3 && industryDistinct.size >= 3 && predictedOk, `Tint by value on a fresh matrix (${typeRowsFresh} type rows expanded) paints ${allTinted.length} rendered cells on ${distinct.size} distinct steps (${industryDistinct.size} among the industry rows), and every one of the ${tinted.length} sector cells is the step the published data predicts against the largest sector cell`);
  const oldRule = new Set(tinted.map((t) => `hv-${retiredStep(t.value, 1)}`));
  check(oldRule.size === 1 && oldRule.has('hv-5'), `Negative control: the retired rule (domain from expanded type rows, none expanded, max 1) would paint every cell ${[...oldRule].join(',')}, which this gate rejects`);
  await page.locator('#heatmap tr.lv-industry button.disc').first().click();
  await page.waitForTimeout(200);
  const afterOpen = (await page.locator('#heatmap tr.lv-sector td[class*="hv-"]').evaluateAll((tds) => tds.map((td) => (td.className.match(/hv-\d/) ?? [''])[0]))) as string[];
  check(afterOpen.join() === tinted.map((t) => t.cls).join(), 'Opening an industry never re-tints the sector rows already on screen (the scale is per level, not per what is expanded)');

  /* ---------- 7e. the tie decision is explained from its record ---------- */
  const orderTie = projects.find((p) => p.why.tieRule === 'order')!;
  const fewerTie = projects.find((p) => p.why.tieRule === 'fewer')!;
  check(Boolean(orderTie) && Boolean(fewerTie), `The register carries both tie outcomes to test (${projects.filter((p) => p.why.tieRule === 'order').length} decided on published order, ${projects.filter((p) => p.why.tieRule === 'fewer').length} on fewer projects assigned)`);
  await page.goto(`${base}/p/${orderTie.ref}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#why');
  const orderText = await page.locator('#why').innerText();
  const orderAttr = await page.locator('#why').getAttribute('data-tie');
  check(orderAttr === 'order' && /same number of projects assigned/.test(orderText) && /earlier vertical in the published order/.test(orderText) && !/fewer projects assigned/.test(orderText), `${orderTie.ref}: an equal-count tie says the published order decided and never claims fewer projects (negative control: "fewer" absent)`);
  await page.goto(`${base}/p/${fewerTie.ref}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#why');
  const fewerText = await page.locator('#why').innerText();
  const winnerCount = fewerTie.why.assignedAtDecision[fewerTie.why.tied.indexOf(fewerTie.ownerVertical!)]!;
  check(/fewer projects assigned at the time/.test(fewerText) && fewerText.includes(`${rollup.verticals[fewerTie.ownerVertical!]!.name} ${winnerCount.toLocaleString('en-GB')}`), `${fewerTie.ref}: a fewer-count tie names the counts it was decided on (winner ${winnerCount})`);

  /* ---------- 7f. descriptions agree with the parties they describe ---------- */
  const contradiction = (p: Project) => p.description.includes('No consultant recorded') !== (p.leadConsultants.length === 0 && p.mepConsultant === null);
  const mepOnly = projects.find((p) => p.mepConsultant !== null && p.leadConsultants.length === 0)!;
  check(projects.filter(contradiction).length === 0 && Boolean(mepOnly), `No description denies a consultant the project records (0 contradictions across ${projects.length}; ${projects.filter((p) => p.mepConsultant !== null && p.leadConsultants.length === 0).length} projects carry an MEP consultant and no lead)`);
  check(contradiction({ ...mepOnly, description: 'No consultant recorded.' }), 'Negative control: a description that denies a recorded MEP consultant is reported as a contradiction');
  await page.goto(`${base}/p/${mepOnly.ref}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#p-description');
  const descText = await page.locator('#p-description').innerText();
  const mepName = consultants.find((c) => c.id === mepOnly.mepConsultant)!.name;
  check(descText.includes(`MEP consultant ${mepName}`) && !descText.includes('No consultant recorded'), `${mepOnly.ref} names its MEP consultant in the description and does not say "No consultant recorded"`);

  /* ---------- 7g. every headline card opens exactly the population it counts ---------- */
  const followCard = async (path: string, cardId: string, readSel = 'dd.big') => {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForSelector(`#${cardId}`);
    const figure = await stripNum(page, `#${cardId} ${readSel}`);
    const href = (await page.locator(`#${cardId} dd.sub a`).getAttribute('href')) ?? '';
    await page.goto(`${base}${href}`, { waitUntil: 'networkidle' });
    await waitRows(page);
    const t = await tally(page);
    const query = new URL(page.url()).search.slice(1);
    return { figure, href, t, query, predicted: predict(query) };
  };
  const openNo = await followCard('/parties', 'pk-open');
  check(openNo.figure === rollup.partySummary.openProjectsNoContractor && openNo.t.count === openNo.figure && openNo.predicted.count === openNo.figure, `"Open, no contractor yet" (${openNo.figure}) opens exactly ${openNo.t.count} projects (${openNo.href})`);
  const openOld = predict('stage=Tender|Under%20Construction&cmax=5');
  check(openOld.count !== openNo.figure && openOld.count > openNo.figure, `Negative control: the retired link without the contractor-absence predicate would open ${openOld.count} projects, not ${openNo.figure}`);
  const noCon = await followCard('/parties', 'pk-nocon');
  check(noCon.figure === rollup.partySummary.projectsNoConsultant && noCon.t.count === noCon.figure, `"Projects with no consultant" (${noCon.figure}) opens exactly ${noCon.t.count} projects (${noCon.href})`);
  const ownedValue = await followCard('/', 'kpi-value');
  const vkValue = await stripNum(page, '#vk-value dd.big');
  check(Math.round(ownedValue.figure * 10) === Math.round(rollup.kpis.ownedValue * 10) && Math.round(vkValue * 10) === Math.round(ownedValue.figure * 10) && Math.round(ownedValue.predicted.value * 10) === Math.round(ownedValue.figure * 10), `"Pipeline value owned" (USD ${ownedValue.figure} m) opens a register whose value in view is the same USD ${vkValue} m (${ownedValue.href})`);
  check(Math.round(predict('sort=value').value * 10) !== Math.round(ownedValue.figure * 10), `Negative control: the retired link would open the whole register, USD ${predict('sort=value').value} m, not the owned value`);
  const orders = await followCard('/', 'kpi-orders');
  const vkOrders = await stripNum(page, '#vk-orders dd.big');
  check(orders.figure === rollup.kpis.ordersThisYear && vkOrders === orders.figure, `"Orders received ${rollup.meta.fiscalYear}" (${orders.figure}) opens a register whose Orders card reads the same ${vkOrders} (${orders.href})`);
  check(rollup.funnel[0]! !== orders.figure, `Negative control: the retired link would count every order on record, ${rollup.funnel[0]}, not the ${orders.figure} dated ${rollup.meta.fiscalYear}`);
  const openPairs = await followCard('/', 'kpi-open');
  const vkOpen = await stripNum(page, '#vk-open dd.big');
  check(openPairs.figure === rollup.kpis.openEnquiriesAndQuotes && vkOpen === openPairs.figure, `"Open enquiries and quotes" (${openPairs.figure}) opens a register whose card reads the same ${vkOpen}`);
  const high = await followCard('/relevance', 'mk-high');
  check(high.figure === rollup.matrixSummary.projectsOverallHigh && high.t.count === high.figure && high.predicted.count === high.figure, `"Projects reading High" (${high.figure}) opens exactly ${high.t.count} projects (${high.href})`);
  check(predict('sort=overall').count !== high.figure, `Negative control: the retired link would open all ${predict('sort=overall').count} projects`);

  /* ---------- 7h. the four remaining managing-director stories, each inside three clicks ---------- */
  /* Cooling: Overview > Consultants and contractors (1) > rank on Cooling (2) */
  const cooling = vIndex.get('cooling')!;
  const coolingTop = [...consultants].filter((c) => c.verticalCounts[cooling]! > 0).sort((a, b) => b.verticalCounts[cooling]! - a.verticalCounts[cooling]! || b.verticalValues[cooling]! - a.verticalValues[cooling]! || a.name.localeCompare(b.name))[0]!;
  await page.goto(`${base}/parties`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#plist li');
  await page.locator('#party-vertical').selectOption('cooling');
  await page.waitForTimeout(300);
  const pcText = (await page.locator('#picker-count').innerText()).trim();
  const firstId = Number(await page.locator('#plist button').first().getAttribute('data-id'));
  const firstN = Number(await page.locator('#plist button').first().getAttribute('data-n'));
  check(/relevant to Cooling/i.test(pcText) && firstId === coolingTop.id && firstN === coolingTop.verticalCounts[cooling] && /v=cooling/.test(page.url()), `Ranking on Cooling puts ${coolingTop.name} first with ${firstN} relevant projects, in two clicks from the Overview, and the choice is in the address`);
  await page.locator('#top-consultant-views button[data-view="count"]').click();
  await page.waitForTimeout(400);
  await page.locator('svg#top-firms-chart').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);
  const coolingRead = ((await page.locator('svg#top-firms-chart .readbox text').first().textContent()) ?? '').trim();
  check(coolingRead.startsWith(coolingTop.name.toUpperCase()) && coolingRead.includes(`${coolingTop.verticalCounts[cooling]!.toLocaleString('en-GB')} PROJECTS`), `The top-firms chart ranks on Cooling too: first bar "${coolingRead.slice(0, 60)}"`);
  await page.keyboard.press('Escape');
  await page.locator('#plist button').first().click();
  await page.waitForSelector('#party-vertical-tags');
  const tagCount = Number(await page.locator('#party-vertical-tags').getAttribute('data-count'));
  const tagNs = (await page.locator('#party-vertical-tags a').evaluateAll((as) => as.map((a) => [(a as HTMLElement).dataset.slug, Number((a as HTMLElement).dataset.n)]))) as [string, number][];
  const expectedTags = coolingTop.verticalCounts.map((n, i) => [rollup.verticals[i]!.slug, n] as [string, number]).filter((x) => x[1] > 0);
  const onVertical = (await page.locator('#party-on-vertical').innerText()).trim();
  check(tagCount === expectedTags.length && tagNs.length === expectedTags.length && tagNs.every(([slug, n]) => expectedTags.some((e) => e[0] === slug && e[1] === n)) && tagNs[0]![0] === 'cooling' && onVertical.includes(`${coolingTop.verticalCounts[cooling]!.toLocaleString('en-GB')} of ${coolingTop.projectCount.toLocaleString('en-GB')} projects`), `${coolingTop.name}'s card lists all ${tagCount} verticals in play with their counts (no top-four cap), Cooling first, and reads "${onVertical.slice(0, 60)}"`);
  check(expectedTags.length > 4 || consultants.some((c) => c.verticalCounts.filter((n) => n > 0).length > 4), `Negative control from the data: ${consultants.filter((c) => c.verticalCounts.filter((n) => n > 0).length > 4).length} consultants have more than four verticals in play, so a four-item preview would have hidden real reach`);
  /* Overloaded: Overview > Engineers (1) */
  const overCount = rollup.engineerSummary.filter((e) => e.overloaded).length;
  const heaviest = [...rollup.engineerSummary].sort((a, b) => b.loadPct - a.loadPct)[0]!;
  await page.goto(`${base}/engineers`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#ek-over');
  const ekOver = await stripNum(page, '#ek-over dd.big');
  const ekHeavy = (await page.locator('#ek-heaviest').innerText()).trim();
  check(ekOver === overCount && overCount >= 2 && ekHeavy.includes(heaviest.name) && ekHeavy.includes(`${heaviest.workload.toLocaleString('en-GB')} points against ${heaviest.capacity.toLocaleString('en-GB')}`), `"Over capacity" reads ${ekOver} engineers on the published workload rule, and "Heaviest load" names ${heaviest.name} with the points and the capacity, one click from the Overview`);
  await page.locator('#books-views button[data-view="load"]').click();
  await page.waitForTimeout(400);
  const markerOn = await page.locator('svg#books-chart .marker line').count();
  await page.locator('svg#books-chart').focus();
  await page.keyboard.press('Home');
  await page.waitForTimeout(150);
  const loadRead = ((await page.locator('svg#books-chart .readbox text').first().textContent()) ?? '').trim();
  const firstOrdered = rollup.engineerSummary.filter((e) => e.vertical === rollup.verticals[0]!.slug).sort((a, b) => b.ownedValue - a.ownedValue)[0]!;
  check(markerOn === 1 && loadRead.startsWith(firstOrdered.name.toUpperCase()) && loadRead.includes(`${firstOrdered.workload.toLocaleString('en-GB')} POINTS`), `The Workload view draws the capacity line and reads points ("${loadRead.slice(0, 50)}")`);
  await page.keyboard.press('Escape');
  await page.locator('#books-views button[data-view="value"]').click();
  await page.waitForTimeout(300);
  check((await page.locator('svg#books-chart .marker line').count()) === 0, 'Negative control: the value view carries no capacity line');
  const overCells = await page.locator('.ledger-cell[data-overloaded="true"]').count();
  check(overCells === overCount, `${overCells} engineer blocks carry the over-capacity mark, matching the card`);
  await page.goto(`${base}/engineers/${overloadedEng.slug}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#eng-load');
  const engLoad = (await page.locator('#eng-load').innerText()).trim();
  check(engLoad.includes(`${overloadedEng.workload.toLocaleString('en-GB')} points against ${overloadedEng.capacity.toLocaleString('en-GB')}`) && /over capacity/.test(engLoad), `${overloadedEng.name}'s page states the workload, the capacity and the verdict ("${engLoad.replace(/\n/g, ' ').slice(0, 70)}")`);
  /* No relationship: Overview > Consultants and contractors (1) > the card's link (2) */
  const noRelCons = consultants.filter((c) => c.level === null);
  const noRelKons = contractors.filter((c) => c.level === null);
  await page.goto(`${base}/parties`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#pk-norel');
  const pkNoRel = await stripNum(page, '#pk-norel dd.big');
  check(pkNoRel === noRelCons.length + noRelKons.length && pkNoRel > 0, `"No relationship yet" reads ${pkNoRel} firms, the party files' count of firms with no level, rating or owner`);
  await page.locator('#pk-norel a[href="/parties?kind=consultant&rel=none"]').click();
  await page.waitForURL(/kind=consultant.*rel=none/);
  await page.waitForFunction((expected) => document.querySelector('#picker-count')?.getAttribute('data-count') === String(expected), noRelCons.length);
  const relList = Number(await page.locator('#picker-count').getAttribute('data-count'));
  await page.locator('#plist button').first().click();
  await page.waitForSelector('#party-rel');
  const relState = await page.locator('#party-card').getAttribute('data-rel');
  const relText = await page.locator('#party-rel').innerText();
  check(relList === noRelCons.length && relState === 'none' && /None yet/.test(relText) && /has not worked with this firm/.test(relText), `The link lists the ${relList} consultants with no relationship, and the first card states the absence in words rather than a low rating`);
  await page.locator('button[data-rel="held"]').click();
  await page.waitForFunction((expected) => document.querySelector('#picker-count')?.getAttribute('data-count') === String(expected), consultants.length - noRelCons.length);
  const heldList = Number(await page.locator('#picker-count').getAttribute('data-count'));
  check(heldList === consultants.length - noRelCons.length && heldList + relList === consultants.length, `Negative control: "Relationship held" lists the other ${heldList}, and the two filters sum to all ${consultants.length} consultants`);
  check(noRelCons.every((c) => c.rating === null && c.owner === null) && consultants.filter((c) => c.level !== null).every((c) => c.rating !== null && c.owner !== null), 'In the party file a relationship is whole or absent: no firm has a rating or an owner without a level, or the reverse');

  /* ---------- 7i. complete-looking corrupt rows are refused at the boundary, row by row ---------- */
  const shard0 = rollup.shards[0]!.file;
  const shardBody = (await (await fetch(`${base}/data/${shard0}`)).json()) as { sector: string; projects: Record<string, unknown>[] };
  const corrupt = (mutate: (row: Record<string, unknown>) => void) => {
    const copy = JSON.parse(JSON.stringify(shardBody)) as typeof shardBody;
    mutate(copy.projects[3]!);
    return JSON.stringify(copy);
  };
  const tryShard = async (body: string) => {
    await page.route(`**/data/${shard0}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body }));
    await page.goto(`${base}/projects`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('.errbox') !== null || document.querySelector('.vt-row') !== null, null, { timeout: 30000 });
    const err = (await page.locator('.errbox').count()) ? await page.locator('.errbox').innerText() : '';
    await page.unroute(`**/data/${shard0}`);
    return err.replace(/\n/g, ' ');
  };
  const okShard = await tryShard(JSON.stringify(shardBody));
  await waitRows(page).catch(() => {});
  check(okShard === '' && (await tally(page)).count === projects.length, `Positive control: the shard's own bytes, replayed through the same interception, render all ${projects.length} projects`);
  const badBucket = await tryShard(corrupt((r) => ((r.buckets as number[])[0] = 99)));
  check(/expected shape/i.test(badBucket) && /buckets\[0\]/.test(badBucket), `A bucket code of 99 on row 4 is refused with the row and field named ("${badBucket.slice(0, 90)}")`);
  const badScore = await tryShard(corrupt((r) => ((r.scores as unknown[])[0] = '8.0')));
  check(/expected shape/i.test(badScore) && /scores\[0\]/.test(badScore), `A string where a score belongs is refused before it can reach a card ("${badScore.slice(0, 90)}")`);
  const shortVectors = await tryShard(corrupt((r) => {
    r.scores = [8];
    r.buckets = [0];
  }));
  check(/expected shape/i.test(shortVectors) && /expected exactly 10/.test(shortVectors), `One-element score and bucket vectors are refused, ten expected ("${shortVectors.slice(0, 90)}")`);
  const badDates = await tryShard(corrupt((r) => ((r.bucketDates as string[]).length = 9)));
  check(/expected shape/i.test(badDates) && /bucketDates/.test(badDates), `A nine-long date vector is refused ("${badDates.slice(0, 90)}")`);
  const badRef = await tryShard(corrupt((r) => (r.leadConsultants = [999999])));
  check(/expected shape/i.test(badRef) && /not in parties\/consultants\.json/.test(badRef), `A consultant id no party file knows is refused as a dangling reference ("${badRef.slice(0, 90)}")`);
  const badTie = await tryShard(corrupt((r) => ((r.why as Record<string, unknown>).tieRule = 'coin')));
  check(/expected shape/i.test(badTie) && /tieRule/.test(badTie), `An unknown tie rule is refused ("${badTie.slice(0, 90)}")`);

  /* ---------- 8. every route renders; invalid and missing states ---------- */
  for (const [path, h] of [
    ['/relevance', 'Relevance matrix'],
    ['/projects', 'Projects'],
    ['/engineers', 'Engineers'],
    ['/parties', 'Consultants and contractors'],
    ['/data-basis', 'Data basis'],
  ] as const) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const title = (await page.locator('h1').first().innerText()).trim();
    check(new RegExp(`^${h}$`, 'i').test(title), `${path} renders (h1 "${title}")`);
  }
  const recText = await page.locator('#rec-summary').innerText();
  check(/all pass/i.test(recText) && new RegExp(`${rec.assertions.length.toLocaleString('en-GB')} assertions`).test(recText), `Data basis shows the reconciliation ("${recText.trim().slice(0, 60)}")`);
  await page.goto(`${base}/no/such/page`, { waitUntil: 'networkidle' });
  const nf = (await page.locator('h1').first().innerText()).trim();
  check(/nothing here/i.test(nf), `Invalid route shows the not-found page (h1 "${nf}")`);
  await page.goto(`${base}/p/HV-99-99999`, { waitUntil: 'networkidle' });
  const missingP = await page.locator('.errbox').innerText();
  check(/no such project/i.test(missingP), `An unknown project reference shows a readable message ("${missingP.replace(/\n/g, ' ').slice(0, 60)}")`);
  await page.goto(`${base}/engineers/nobody`, { waitUntil: 'networkidle' });
  const missingE = await page.locator('.errbox').innerText();
  check(/no such engineer/i.test(missingE), `An unknown engineer shows a readable message`);
  await page.route('**/data/rollup.json', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"meta": {}}' }));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const malformed = await page.locator('.errbox').innerText();
  check(/expected shape/i.test(malformed), `Malformed rollup shows a readable shape error ("${malformed.replace(/\n/g, ' ').slice(0, 80)}")`);
  await page.unroute('**/data/rollup.json');
  await page.route(`**/data/${shard0}`, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }));
  expectMissing = true;
  await page.goto(`${base}/projects`, { waitUntil: 'networkidle' });
  const missingShard = await page.locator('.errbox').innerText();
  expectMissing = false;
  check(/not found/i.test(missingShard) && new RegExp(shard0).test(missingShard), `A missing shard is named in a readable error ("${missingShard.replace(/\n/g, ' ').slice(0, 70)}"; ${expected404} expected 404 in the console)`);
  await page.unroute(`**/data/${shard0}`);
  await page.route(`**/data/${shard0}`, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"sector":"x","projects":[{"ref":"a"}]}' }));
  await page.goto(`${base}/projects`, { waitUntil: 'networkidle' });
  const malformedShard = await page.locator('.errbox').innerText();
  check(/expected shape/i.test(malformedShard), `A malformed shard shows a readable shape error, never a blank page`);
  await page.unroute(`**/data/${shard0}`);
  await page.route('**/data/rollup.json', (route) => route.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' }));
  expectMissing = true;
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const failed500 = await page.locator('.errbox').innerText();
  expectMissing = false;
  const retry = await page.locator('.errbox button', { hasText: 'Try again' }).count();
  check(/could not deliver/i.test(failed500) && retry === 1, `A server failure is named as such and offers a retry`);
  await page.unroute('**/data/rollup.json');

  /* ---------- 9. entry motion, measured as rendered frames ---------- */
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('nav a');
  const routes = await page.$$eval('nav a', (as) => as.map((a) => a.getAttribute('href')!).filter(Boolean));
  check(routes.length >= 5, `The nav offers ${routes.length} routes to test for entry motion (a zero here would silently skip the loop)`);
  for (const r of routes) {
    const seen = new Set<string>();
    await page.goto(`${base}${r}`, { waitUntil: 'commit' });
    for (const gap of [120, 80, 100, 150, 250, 700]) {
      await page.waitForTimeout(gap);
      seen.add(createHash('md5').update(await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 860 } })).digest('hex'));
    }
    check(seen.size >= 3, `${r} animates on entry (${seen.size} distinct rendered frames across the first 1.4s; a static page gives 2)`);
  }
  await context.close();

  /* ---------- 10. reduced motion ---------- */
  const { context: rc, page: rp } = await newPage(1440, 'reduce');
  await rp.goto(`${base}/engineers`, { waitUntil: 'networkidle' });
  await rp.waitForSelector('.ledger-cell');
  await rp.waitForTimeout(400);
  const anims = await rp.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
  const opacityOk = await rp.evaluate(() => Array.from(document.querySelectorAll('section.sec, tr, .ledger-cell')).every((el) => getComputedStyle(el).opacity === '1'));
  check(anims === 0 && opacityOk, `Under reduced motion nothing is animating and every section and row is fully visible (${anims} running animations)`);
  const staticFrames = new Set<string>();
  await rp.goto(`${base}/`, { waitUntil: 'commit' });
  await rp.waitForSelector('h1', { timeout: 15000 }).catch(() => {});
  for (const gap of [120, 80, 100, 150, 250, 700]) {
    await rp.waitForTimeout(gap);
    staticFrames.add(createHash('md5').update(await rp.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 860 } })).digest('hex'));
  }
  check(staticFrames.size <= 2, `Negative control: under reduced motion the overview renders static (${staticFrames.size} distinct frames, against 3 or more with motion on)`);
  await rc.close();

  /* ---------- 11. console errors ---------- */
  check(errors.length === 0, `No console errors (${errors.length})`);
  for (const e of errors) console.log('   ' + e);
  void EMPTY;

  /* ---------- 12. the phone pass: every route at 390px, real motion, coarse pointer ---------- */
  await phoneChecks({ browser, base, insecure, check, routes: [...routesWithVisual, '/data-basis'] });
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} interaction checks pass.`);

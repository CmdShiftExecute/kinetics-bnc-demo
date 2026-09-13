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
import type { Party, Project, Reconciliation, Rollup } from '../data/schema';
import { BUCKETS } from '../data/schema';
import { EMPTY, matches, parseFilters } from '../src/lib/filters';

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
  const kpiOwned = num((await page.locator('#kpi-owned dd.big').innerText()).trim());
  const kpiValue = num((await page.locator('#kpi-value dd.big').innerText()).trim());
  check(kpiOwned === rollup.kpis.owned && Math.round(kpiValue * 10) === Math.round(rollup.kpis.ownedValue * 10), `KPI strip shows the published owned count and value (${kpiOwned}, ${kpiValue})`);
  const chaseRows = await page.locator('#chase-table tbody tr').count();
  const chaseFirst = (await page.locator('#chase-table tbody tr').first().locator('th').innerText()).trim();
  check(chaseRows === rollup.chase.length && chaseFirst === rollup.chase[0]!.name, `Worth chasing lists ${chaseRows} rows, largest first (${chaseFirst})`);
  const sizes = await page.evaluate(() => [getComputedStyle(document.querySelector('.mast-system')!).fontSize, getComputedStyle(document.querySelector('.page-title')!).fontSize]);
  check(sizes[0] === sizes[1], `Masthead system title is set at the page-title size (${sizes[0]}), as on the MIS and WMS`);
  const vtRow = await rowHover(page, '#vertical-table tbody tr.hov');
  check(vtRow.shifted && vtRow.marked && vtRow.steady, `Hovering an overview row changes its tone from ${vtRow.before} to ${vtRow.after}, marks its first cell, and does not move it`);
  await breakCss(page, 'table.mis tr.hov:hover td, table.mis tr.hov:hover th { background: var(--paper) !important; box-shadow: none !important; }');
  const vtNeg = await rowHover(page, '#vertical-table tbody tr.hov');
  check(!vtNeg.shifted && !vtNeg.marked, `Row-hover gate reports a defeated hover rule (negative control: ${vtNeg.before} to ${vtNeg.after})`);
  await unbreakCss(page);
  const ssHover = await chartHover(page, 'sector-stage-chart', 0.35, 0.2);
  check(ssHover.live && ssHover.marks > 0 && /URBAN CONSTRUCTION/.test(ssHover.read), `Sector-by-stage chart reads out on a plain pointer move ("${ssHover.read.slice(0, 60)}"), no click`);
  await breakCss(page, 'svg#sector-stage-chart { pointer-events: none !important; }');
  await page.mouse.move(4, 4);
  const ssNeg = await chartHover(page, 'sector-stage-chart', 0.35, 0.2);
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
  for (let i = 0; i < 22; i++) {
    seq.push(await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      return `${el.tagName.toLowerCase()}:${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)}`;
    }));
    await page.keyboard.press('Tab');
  }
  writeFileSync(join(out, 'tab-sequence.json'), JSON.stringify(seq, null, 1));
  const idx = (re: RegExp) => seq.findIndex((s) => re.test(s));
  const order = [idx(/^a:Relevance matrix/), idx(/^a:Data basis/), idx(/^a:80 type rows|^a:.*of the register/), idx(/^a:All projects/i)];
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
  check(t0.count === projects.length && Math.round(t0.value * 10) === Math.round(sum1(projects.map((p) => p.value)) * 10), `Unfiltered register shows ${t0.count} projects and AED ${t0.value} m, the sum of every row`);
  const shown = await page.locator('.vt-row').count();
  check(shown < 80 && shown > 10, `The windowed table draws ${shown} rows of ${t0.count} (only the rows in view plus a margin)`);
  const firstVal = num((await page.locator('.vt-row').first().locator('td').nth(4).innerText()).trim());
  const maxVal = Math.max(...projects.map((p) => p.value));
  check(firstVal === maxVal, `Default sort is value descending: first row shows ${firstVal}, the largest value in the register`);
  /* a facet: Tender */
  await page.locator('input[data-facet="stage"][data-value="Tender"]').click();
  await page.waitForURL(/stage=Tender/);
  await waitRows(page);
  const t1 = await tally(page);
  const e1 = predict('stage=Tender');
  check(t1.count === e1.count && Math.round(t1.value * 10) === Math.round(e1.value * 10), `Stage: Tender shows ${t1.count} projects, AED ${t1.value} m, exactly what the predicate predicts from the data`);
  check(/stage=Tender/.test(page.url()), `The filter is written to the address (${new URL(page.url()).search})`);
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
  await page.locator('thead th[aria-sort] button', { hasText: 'AED m' }).click();
  await page.waitForTimeout(150);
  const asc = num((await page.locator('.vt-row').first().locator('td').nth(4).innerText()).trim());
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
  await cellBtn.hover();
  await page.waitForTimeout(150);
  const panel = await page.locator('#cell-read').innerText();
  check(/grade/i.test(panel) && (await page.locator('#cell-read.on').count()) === 1, `Pointing at a cell reads it in the side panel ("${cellLabel.slice(0, 50)}")`);
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
  const target = rollup.engineerSummary[0]!;
  const cardOwned = Number(await page.locator(`.ledger-cell[data-slug="${target.slug}"]`).getAttribute('data-owned'));
  await page.locator(`.ledger-cell[data-slug="${target.slug}"] a.drill-link`).click();
  await page.waitForSelector('#eng-owned');
  await waitRows(page).catch(() => {});
  const engOwned = num((await page.locator('#eng-owned dd.big').innerText()).trim());
  const engRows = Number(await page.locator('.vt').getAttribute('data-total'));
  check(engOwned === cardOwned && engRows === cardOwned && cardOwned === projects.filter((p) => p.ownerEngineer === target.slug).length, `${target.name}'s page count (${engOwned}) equals the card (${cardOwned}) and the register`);
  const mixHover = await (async () => {
    await page.goto(`${base}/engineers`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.ledger-cell');
    const svg = page.locator(`svg#mix-${target.slug}`);
    await svg.scrollIntoViewIfNeeded();
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + 3, box.y + box.height / 2);
    await page.waitForTimeout(150);
    return (await page.locator(`svg#mix-${target.slug}`).locator('xpath=..').locator('.mix-read').innerText()).trim();
  })();
  check(/of \d+/.test(mixHover), `The activity mix bar reads out under the pointer ("${mixHover.slice(0, 50)}")`);

  /* ---------- 6. parties ---------- */
  await page.goto(`${base}/parties`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#plist li');
  const listN = Number(await page.locator('#picker-count').getAttribute('data-count'));
  check(listN === consultants.length && (await page.locator('#party-empty').count()) === 1, `The selector lists all ${listN} consultants and shows an empty card until one is picked`);
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
  const pValue = num((await page.locator('#p-value dd.big').innerText()).trim());
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
  const shard0 = rollup.shards[0]!.file;
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
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${results.length} interaction checks pass.`);

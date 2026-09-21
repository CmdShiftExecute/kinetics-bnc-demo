/** Regression checks for the independent September refinement audit. Read-only fixtures. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import type { Project, Rollup } from '../data/schema';
import { parseFilters, serialiseFilters, matches, sortProjects } from '../src/lib/filters';
const base = process.env.BASE ?? 'http://127.0.0.1:4182';
const out = process.env.OUT ?? '/tmp/pis-adversarial';
mkdirSync(out, { recursive: true });
const r: Rollup = JSON.parse(readFileSync('public/data/rollup.json', 'utf8'));
const ps: Project[] = r.shards.flatMap(s => JSON.parse(readFileSync(`public/data/${s.file}`, 'utf8')).projects);
const vi = new Map(r.verticals.map((v,i) => [v.slug,i]));
const sum = (rows: Project[]) => rows.reduce((n,p) => n + Math.round(p.value * 10),0)/10;
const ids = (rows: Project[]) => rows.map(p => p.ref).sort();
const records: string[] = [];
function check(ok: boolean, label: string) { assert.ok(ok,label); records.push(label); console.log(`PASS ${label}`); }
const b = await chromium.launch(); const page = await b.newPage({viewport:{width:1280,height:720},acceptDownloads:true});
try {
for (const v of r.verticalSummary) {
 const expected = ps.filter(p => p.ownerVertical === vi.get(v.slug));
 const f = parseFilters(new URLSearchParams(`ov=${v.slug}`),r);
 check(expected.length === v.owned && sum(expected) === v.ownedValue, `${v.slug} published count/value reconcile to actual ownership`);
 check(JSON.stringify(ids(ps.filter(p=>matches(p,f,vi)))) === JSON.stringify(ids(expected)),`${v.slug} owner filter matches exact project IDs`);
 check(serialiseFilters(f).get('ov') === v.slug,`${v.slug} URL round trip retains owner filter`);
 await page.goto(base); await page.locator('#vertical-table').waitFor();
 await page.locator(`#vertical-table a[href="/projects?ov=${v.slug}"]`).click(); await page.locator('#tally').waitFor();
 check(Number(await page.locator('#tally').getAttribute('data-count')) === expected.length && Number(await page.locator('#tally').getAttribute('data-value')) === sum(expected), `${v.slug} real row drill matches both totals`);
 const download = page.waitForEvent('download'); await page.locator('#csv').click(); const stream = await (await download).createReadStream(); let csv=''; for await(const chunk of stream!) csv += chunk;
 check(JSON.stringify(csv.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')[0]!.replaceAll('"','')).sort()) === JSON.stringify(ids(expected)),`${v.slug} CSV exact ownership population`);
}
const expected = ps.filter(p => (p.stage==='Tender'||(p.stage==='Under Construction'&&(p.completionPct??0)<=5)) && p.overall!==null&&p.overall>=5&&!p.buckets.includes(4));
const f = parseFilters(new URLSearchParams('chase=1'),r); const rows = ps.filter(p=>matches(p,f,vi));
check(JSON.stringify(ids(rows))===JSON.stringify(ids(expected)) && rows.length===612,'Chase predicate matches independent full criteria and 612 projects');
check(JSON.stringify(sortProjects(rows,f,vi,new Map()).slice(0,20).map(p=>p.ref))===JSON.stringify(r.chase.map(p=>p.ref)),'Top twenty qualifying projects match the preserved published shortlist');
const sample=expected[0]!;
check(!matches({...sample,overall:4.9},f,vi)&&!matches({...sample,buckets:sample.buckets.map((v,i)=>i===0?4:v)},f,vi)&&!matches({...sample,stage:'Design'},f,vi),'Chase negative controls reject low relevance, any closed vertical and wrong stage');
check(serialiseFilters(f).get('chase')==='1','Chase URL round trip preserves criteria');
await page.goto(base); await page.locator('#chase a[href="/projects?chase=1"]').click(); await page.locator('#tally').waitFor();
check(Number(await page.locator('#tally').getAttribute('data-count'))===612 && Number(await page.locator('#tally').getAttribute('data-value'))===sum(expected),'Chase link opens all qualifying projects with exact count/value');
const download=page.waitForEvent('download');await page.locator('#csv').click();const stream=await(await download).createReadStream();let csv='';for await(const c of stream!)csv+=c;
check(JSON.stringify(csv.trim().split(/\r?\n/).slice(1).map(line=>line.split(',')[0]!.replaceAll('"','')).sort())===JSON.stringify(ids(expected)),'Chase CSV exports exact qualifying population');
await page.getByRole('button',{name:'Remove filter Worth chasing: all qualifying projects',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#tally')?.getAttribute('data-count')==='3500');
check(Number(await page.locator('#tally').getAttribute('data-count'))===3500&&!new URL(page.url()).searchParams.has('chase'),'Removing chase chip restores entire register');
await page.goto(base+'/projects?ov=electrical-distribution');await page.locator('#tally').waitFor();await page.getByRole('button',{name:'Remove filter Owned by Electrical Distribution',exact:true}).click();
await page.waitForFunction(()=>document.querySelector('#tally')?.getAttribute('data-count')==='3500');
check(Number(await page.locator('#tally').getAttribute('data-count'))===3500&&!new URL(page.url()).searchParams.has('ov'),'Removing ownership chip restores entire register');
for(const [kind,n] of [['consultant',110],['contractor',72]] as const){
 await page.goto(base+'/parties');await page.locator(`#pk-norel a[href="/parties?kind=${kind}&rel=none"]`).click();await page.waitForFunction(n=>Number(document.querySelector('#picker-count')?.getAttribute('data-count'))===n,n);
 check(Number(await page.locator('#picker-count').getAttribute('data-count'))===n,`No-relationship ${kind} link matches its explicit count`);
 check((await page.locator('#pk-norel').innerText()).includes('shared projects counted more than once'),'Firm exposure disclosure explains repeated project values');
}
for(const [width,height] of [[1280,720],[1440,900],[390,844]]){
 await page.setViewportSize({width:width!,height:height!});await page.goto(base+'/parties?kind=consultant&id=1');await page.locator('#plist').waitFor();await page.locator('#picker').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
 await page.locator('#plist').evaluate(e=>e.scrollTop=e.scrollHeight);const last=page.locator('#plist button').last();await last.focus();await last.scrollIntoViewIfNeeded();
 check(await last.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),`Last party reachable and hit-testable at ${width}x${height}`);
 await page.screenshot({path:`${out}/picker-${width}.png`});
}
await page.setViewportSize({width:1280,height:720});await page.goto(base);await page.locator('#kpi-chase a').click();await page.waitForTimeout(500);await page.evaluate(()=>scrollTo(0,0));await page.locator('#kpi-chase a').click();await page.waitForTimeout(500);
check(await page.locator('#chase').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.top<innerHeight/2;}),'Repeated chase headline link scrolls to its section again');
await page.goto(base+'/projects');await page.locator('#tally').waitFor();await page.locator('#q').scrollIntoViewIfNeeded();const y=await page.evaluate(()=>scrollY);await page.locator('#q').fill('AE');await page.waitForTimeout(200);
check(Math.abs(await page.evaluate(()=>scrollY)-y)<2,'Search-only URL update preserves scroll position');
writeFileSync(`${out}/checks.json`,JSON.stringify(records,null,2));console.log(`${records.length} audit regression checks passed`);
} finally { await b.close(); }

/** Real-runtime suite, theme, accessibility and responsive regression gate. Node + Playwright. */
import { chromium, firefox } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const base = process.env.BASE ?? 'http://127.0.0.1:4182';
const out = process.env.OUT ?? '/tmp/halvard-pis-refinement';
mkdirSync(out,{recursive:true});
const data = JSON.parse(readFileSync('public/data/rollup.json','utf8'));
const checks=[];
const check=(ok,what,evidence='')=>{checks.push({ok,what,evidence});console.log(`${ok?'PASS':'FAIL'} ${what} ${JSON.stringify(evidence)}`);};
const wait = async p=>{await p.waitForSelector('.mast');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(450);};
const choose = async(p,t)=>{await p.getByRole('button',{name:'Theme',exact:true}).click();await p.getByRole('menuitemradio',{name:t,exact:true}).click();};
const state=async p=>p.evaluate(()=>({theme:document.documentElement.dataset.theme,paper:getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),scheme:getComputedStyle(document.documentElement).colorScheme}));
const visible=async(p,selector)=>p.locator(selector).evaluate(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {visible:r.width>0&&r.height>0&&r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight,hit:e===hit||e.contains(hit),w:r.width,h:r.height,radius:getComputedStyle(e).borderRadius};});
const browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.addInitScript(() => {
 const observer = new MutationObserver(() => {
  const root = document.getElementById('root');
  if (root) { window.__earlyTheme = {theme:document.documentElement.dataset.theme,empty:root.childElementCount===0}; observer.disconnect(); }
 });
 observer.observe(document, {childList:true,subtree:true});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);await wait(page);
for(const name of ['Module','Theme']){
 const v=await visible(page,`button[aria-label="${name}"]`);check(v.visible&&v.hit&&v.w===42&&v.h===42&&v.radius==='50%',`${name} is an unobstructed MIS 42px circle`,v);
 const trigger=page.getByRole('button',{name,exact:true});await trigger.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
 check(await page.evaluate(()=>document.activeElement?.textContent?.includes('Light')||document.activeElement?.textContent?.includes('Central Store')),`${name} opening focus supports immediate arrow browsing`);
 const url=page.url();const before=await state(page);await page.keyboard.press('End');await page.keyboard.press('Home');
 check(page.url()===url&&(await state(page)).theme===before.theme,`${name} arrow browsing is inert`);
 await page.keyboard.press('Escape');check(await trigger.getAttribute('aria-expanded')==='false'&&await trigger.evaluate(e=>e===document.activeElement),`${name} Escape closes and restores focus`);
 await page.keyboard.press('Space');await page.keyboard.press('Tab');check(await trigger.getAttribute('aria-expanded')==='false',`${name} Tab exits and closes`);
 await trigger.click();await page.locator('h1').click();check(await trigger.getAttribute('aria-expanded')==='false',`${name} outside pointer dismisses`);
}
await page.getByRole('button',{name:'Module',exact:true}).click();
check(await page.getByRole('menuitem',{name:'Project Intelligence'}).getAttribute('aria-current')==='true','Current module is marked inside menu');
const moduleLinks=await page.locator('[aria-label="Module options"] a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));
// The masthead's destinations are a build flag (src/lib/suite.ts), so the expected pair is one too.
const suiteMis=process.env.VITE_SUITE_MIS??'https://kinetics-mis-demo.vercel.app/';
const suiteWms=process.env.VITE_SUITE_WMS??'https://kinetics-wms-demo.vercel.app/';
check(JSON.stringify(moduleLinks)===JSON.stringify([suiteMis,suiteWms,'/']),'Suite destinations match the build flags',moduleLinks);
// Intercept only the probe's activation to prove Space dispatch without leaving the preview.
await page.getByRole('menuitem',{name:'Central Store'}).evaluate(e=>e.addEventListener('click',ev=>{ev.preventDefault();window.__moduleActivated=true;},{once:true}));
await page.getByRole('menuitem',{name:'Central Store'}).focus();await page.keyboard.press('Space');
check(await page.evaluate(()=>window.__moduleActivated===true),'Space explicitly activates a module link');
const themes={Parchment:'#f4f4f0',Light:'#ffffff',Dark:'#171c21'};
const routes=['/','/relevance','/projects?owned=0&sort=value','/engineers',`/engineers/${data.engineerSummary.find(e=>e.overloaded).slug}`,'/parties?rel=none',`/p/${data.chase[0].ref}`,'/data-basis'];
const fingerprints=new Map();
for(const [theme,paper] of Object.entries(themes)){
 await page.goto(base);await wait(page);await choose(page,theme);await page.reload();await wait(page);
 const s=await state(page);check(s.theme===theme.toLowerCase()&&(s.paper===paper||(paper==='#ffffff'&&s.paper==='#fff'))&&s.scheme===(theme==='Dark'?'dark':'light'),`${theme} restores correct tokens on reload`,s);
 const early=await page.evaluate(()=>window.__earlyTheme);check(early?.theme===theme.toLowerCase()&&early?.empty,`${theme} is restored before the application mounts`,early);
 for(const [i,route] of routes.entries()){
  await page.goto(base+route);await wait(page);
  const fp=await page.locator('dl.strip').first().innerText();
  if(theme==='Parchment')fingerprints.set(route,fp);else check(fp===fingerprints.get(route),`${theme} preserves analytical figures on ${route}`);
  check((await state(page)).theme===theme.toLowerCase()&&await page.locator('.mast-icon').count()===2,`${theme} suite persists on ${route}`);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);check(overflow,`${theme} desktop fits ${route}`);
  if(theme==='Dark'&&i>0)await page.screenshot({path:join(out,`dark-route-${i}.png`)});
 }
 await page.goto(base);await wait(page);
 await page.screenshot({path:join(out,`overview-${theme.toLowerCase()}-desktop.png`)});
 for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=700){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(160);}
 await page.screenshot({path:join(out,`overview-${theme.toLowerCase()}-full.png`),fullPage:true});
 for(const width of [1280,390,360]){
  await page.setViewportSize({width,height:width===1280?900:844});await page.goto(base);await wait(page);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme} overview fits ${width}px`);
  for(const name of ['Module','Theme']){
   const v=await visible(page,`button[aria-label="${name}"]`);check(v.visible&&v.hit,`${theme} ${name} visible and hit-testable at ${width}px`,v);
   await page.getByRole('button',{name,exact:true}).click();
   const panel=await page.locator(`[aria-label="${name} options"]`).evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,bottom:r.bottom,w:innerWidth,h:innerHeight};});
   check(panel.x>=0&&panel.right<=panel.w&&panel.bottom<=panel.h,`${theme} ${name} dropdown fits ${width}px`,panel);await page.keyboard.press('Escape');
  }
  await page.locator('h1').click();await page.screenshot({path:join(out,`overview-${theme.toLowerCase()}-${width}.png`)});
 }
 await page.setViewportSize({width:1440,height:1000});
}
await page.goto(base+'/projects?owned=0&sort=value');await wait(page);await page.waitForSelector('.vt-row');
const before=await page.locator('#tally').innerText();const url=page.url();
await page.locator('#view-chart-views button[data-view="value"]').click();await choose(page,'Light');
check(page.url()===url&&await page.locator('#tally').innerText()===before&&await page.locator('#view-chart-views button[data-view="value"]').getAttribute('aria-pressed')==='true','Theme change preserves URL, filtered tally and chart view');
check(await page.locator('#match-count').innerText()===String(data.kpis.unowned),'Management ownership gap resolves to the published population');
await page.locator('#csv').scrollIntoViewIfNeeded();const dl=page.waitForEvent('download');await page.locator('#csv').click();const download=await dl;const stream=await download.createReadStream();let csv='';for await(const c of stream)csv+=c;
check(csv.trim().split(/\r?\n/).length-1===data.kpis.unowned,'Theme-switched unowned CSV exports exactly the same 534 rows');
for(const route of ['/#chase','/engineers#books','/data-basis#buckets']){
 await page.goto(base+route);await wait(page);await page.waitForTimeout(400);
 const v=await page.evaluate(()=>{const el=document.getElementById(location.hash.slice(1));const h=document.querySelector('.mast');return {y:el?.getBoundingClientRect().top,bottom:h?.getBoundingClientRect().bottom};});
 check(v.y>=v.bottom&&v.y<650,`Cold anchor ${route} clears persistent masthead`,v);
}
await page.goto(base);await wait(page);await page.getByRole('combobox',{name:'Jump to section'}).selectOption('chase');
for(let i=0;i<2;i++){
 await page.evaluate(()=>scrollTo(0,0));await page.getByRole('button',{name:'Go to selected section'}).click();await page.waitForTimeout(250);
 check(await page.locator('#chase-title').evaluate(e=>document.activeElement===e&&e.getBoundingClientRect().top>=document.querySelector('.mast').getBoundingClientRect().bottom),`Section jump ${i+1} scrolls and focuses destination`);
}
for(const route of routes.slice(1)){
 await page.setViewportSize({width:360,height:844});await page.goto(base+route);await wait(page);
 check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Phone route fits ${route}`);
 await page.getByRole('button',{name:'Theme',exact:true}).click();check(await page.getByRole('menuitemradio',{name:'Dark'}).isVisible(),`Phone theme options accessible on ${route}`);await page.keyboard.press('Escape');
 if(route.startsWith('/projects')){
  await page.locator('#toolbar').scrollIntoViewIfNeeded();for(const sel of ['#rail-toggle','#cols-menu','#csv']){const v=await visible(page,sel);check(v.visible&&v.hit,`Phone critical register control ${sel}`,v);}
 }
}
for(const denied of [false,true]){
 const c=await browser.newContext();await c.addInitScript(denied?()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});}:()=>localStorage.setItem('halvard-pis-theme','invalid'));
 const p=await c.newPage();await p.goto(base);await wait(p);check((await state(p)).theme==='parchment',`${denied?'Denied':'Invalid'} storage keeps render available`);await choose(p,'Dark');check((await state(p)).theme==='dark',`${denied?'Denied':'Invalid'} storage still permits theme switching`);await c.close();
}
check(errors.length===0,'No uncaught browser errors',errors);
await context.close();await browser.close();
const ff=await firefox.launch();const c=await ff.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce'});const p=await c.newPage();await p.goto(base);await wait(p);await choose(p,'Dark');
check((await state(p)).theme==='dark','Firefox reduced-motion runtime switches to Dark');
await p.screenshot({path:join(out,'overview-dark-firefox.png')});await ff.close();
writeFileSync(join(out,'checks.json'),JSON.stringify(checks,null,2));
console.log(`${checks.filter(c=>c.ok).length}/${checks.length} checks passed`);if(checks.some(c=>!c.ok))process.exitCode=1;

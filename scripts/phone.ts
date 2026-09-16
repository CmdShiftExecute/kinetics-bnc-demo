/**
 * The phone pass of the interaction gate: every route at 390px in mobile Chromium,
 * real motion, scrolled to the end, then measured. Five rules per route, each with a
 * planted negative control on the first route so a detector that has never said
 * "no" is never trusted:
 *
 *   1. the document is no wider than the viewport, so nothing scrolls sideways;
 *   2. every chart label sits inside its own chart (an SVG text drawn past the
 *      left or right edge is cut off, which is how "Electrical Distribution" read
 *      as "ectrical Distribut." on a phone on 16 Sep 2026);
 *   3. every data mark is drawn once its chart has been scrolled to: a bar with a
 *      width has a box and is opaque, an arc has a visible dash;
 *   4. every tap target is at least 24px tall (WCAG 2.5.8), measured under a coarse
 *      pointer so the touch stylesheet is the one being tested;
 *   5. no page error.
 *
 * Chromium cannot reproduce WebKit's IntersectionObserver-on-SVG defect, which is
 * why `check_motion.ts` guards that at the source; this pass proves what Chromium
 * can measure and would catch any chart whose entry never completes here.
 */
import type { Browser, Page } from 'playwright';

export interface PhoneOpts {
  browser: Browser;
  base: string;
  insecure: boolean;
  routes: string[];
  check: (ok: boolean, what: string) => void;
}

export const PHONE_WIDTH = 390;
const MARKS = 'rect.seg, rect.fbar, rect.vbar, rect.aband, rect.sbar, rect.bar, rect.col, rect.step, rect.wf, rect.mbar, circle.arc, circle.dot, path.l-actual, path.line';
const TARGETS = 'a[href], button, select, input, summary, [role="button"], [role="tab"]';

async function settle(page: Page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(1500);
}

function measure(page: Page) {
  return page.evaluate(
    ({ MARKS, TARGETS }) => {
      const vis = (el: Element) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
      };
      const docW = document.documentElement.scrollWidth;
      const clipped: string[] = [];
      const hidden: string[] = [];
      let marks = 0;
      for (const s of document.querySelectorAll('svg')) {
        const sr = s.getBoundingClientRect();
        if (sr.width === 0) continue;
        const name = s.id || s.getAttribute('class') || 'svg';
        for (const t of s.querySelectorAll('text')) {
          const tr = t.getBoundingClientRect();
          if (tr.width === 0) continue;
          if (tr.left < sr.left - 1 || tr.right > sr.right + 1) clipped.push(`${name}: "${(t.textContent ?? '').trim().slice(0, 28)}" at ${Math.round(tr.left - sr.left)}..${Math.round(tr.right - sr.left)} of ${Math.round(sr.width)}`);
        }
        for (const m of s.querySelectorAll(MARKS)) {
          marks++;
          const cs = getComputedStyle(m);
          const mr = m.getBoundingClientRect();
          const tag = m.tagName.toLowerCase();
          const cls = m.getAttribute('class') ?? '';
          const attrW = Number(m.getAttribute('width') ?? 1);
          const attrH = Number(m.getAttribute('height') ?? 1);
          const dash = parseFloat(cs.strokeDasharray);
          const faded = Number(cs.opacity) < 0.95;
          const flat = tag === 'rect' && attrW > 0.5 && attrH > 0.5 && (mr.width < 0.5 || mr.height < 0.5);
          const undrawn = (tag === 'path' || cls.includes('arc')) && Number.isFinite(dash) && dash <= 0.001;
          if (faded || flat || undrawn) hidden.push(`${name}: <${tag}.${cls.split(' ')[0]}> box=${Math.round(mr.width)}x${Math.round(mr.height)} opacity=${cs.opacity} dash=${cs.strokeDasharray}`);
        }
      }
      const small: string[] = [];
      for (const el of document.querySelectorAll(TARGETS)) {
        if (!vis(el)) continue;
        const r = el.getBoundingClientRect();
        /* half a pixel of tolerance: a 23.6px summary is a 24px target to a finger, and the browser rounds it to 24 on screen */
        if (r.height < 23.5) small.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      return { docW, coarse: matchMedia('(pointer: coarse)').matches, clipped, hidden, small, marks };
    },
    { MARKS, TARGETS },
  );
}

/** Plants one of each defect on the live page, so every detector is seen firing. */
function plant(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('svg');
    if (!svg) return false;
    const ns = 'http://www.w3.org/2000/svg';
    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', '-80');
    t.setAttribute('y', '12');
    t.textContent = 'planted off-chart label';
    t.setAttribute('data-planted', '1');
    svg.appendChild(t);
    const r = document.createElementNS(ns, 'rect');
    r.setAttribute('class', 'seg');
    r.setAttribute('x', '10');
    r.setAttribute('y', '10');
    r.setAttribute('width', '20');
    r.setAttribute('height', '10');
    r.setAttribute('style', 'opacity:0');
    r.setAttribute('data-planted', '1');
    svg.appendChild(r);
    const b = document.createElement('button');
    b.textContent = 'planted';
    b.setAttribute('style', 'height:10px;padding:0;line-height:10px;font-size:8px');
    b.setAttribute('data-planted', '1');
    document.body.appendChild(b);
    return true;
  });
}

export async function phoneChecks({ browser, base, insecure, routes, check }: PhoneOpts) {
  const ctx = await browser.newContext({ viewport: { width: PHONE_WIDTH, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: insecure });
  let seen = 0;
  for (const r of routes) {
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + r, { waitUntil: 'networkidle' });
    await settle(page);
    const m = await measure(page);
    seen += m.marks;
    const at = `${r} at ${PHONE_WIDTH}px`;
    check(m.docW <= PHONE_WIDTH, `${at}: the document is ${m.docW}px wide, nothing scrolls sideways`);
    check(m.clipped.length === 0, `${at}: every chart label sits inside its chart (${m.clipped[0] ?? 'none outside'})`);
    check(m.hidden.length === 0, `${at}: every data mark is drawn once scrolled to, ${m.marks} marks (${m.hidden[0] ?? 'none missing'})`);
    check(m.small.length === 0, `${at}: every tap target is at least 24px tall (${m.small.length ? `${m.small.length} under: ${m.small.slice(0, 3).join('; ')}` : 'none under'})`);
    check(errors.length === 0, `${at}: no page error (${errors[0] ?? 'none'})`);
    if (r === routes[0]) {
      check(m.coarse, `${at}: the phone context reports a coarse pointer, so the touch stylesheet is the one measured`);
      const planted = await plant(page);
      const neg = await measure(page);
      check(planted && neg.clipped.length > m.clipped.length && neg.hidden.length > m.hidden.length && neg.small.length > m.small.length, `Phone gate reports a planted off-chart label, an invisible mark and a 10px button (negative control: +${neg.clipped.length - m.clipped.length}/+${neg.hidden.length - m.hidden.length}/+${neg.small.length - m.small.length})`);
    }
    await page.close();
  }
  check(seen > 0, `The phone pass measured ${seen} chart marks across ${routes.length} routes`);
  await ctx.close();
}

/**
 * Frame-timing probe: scrolls the longest page for four seconds in a real
 * Chromium and records requestAnimationFrame intervals.
 *
 * Run:  bun scripts/perf_probe.ts [--base <origin>] [--path /replenishment] [--insecure] [--reduce]
 * Prints median, p95, maximum and the count of intervals above 25 ms. Run it
 * before and after a change on the same machine against the same origin; the
 * numbers are observer-dependent and only comparable under identical conditions.
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : fallback;
};
const base = arg('base', 'http://127.0.0.1:4180').replace(/\/$/, '');
const path = arg('path', '/replenishment');
const insecure = args.includes('--insecure');
const reduce = args.includes('--reduce');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: insecure, reducedMotion: reduce ? 'reduce' : 'no-preference' });
const page = await context.newPage();
const t0 = Date.now();
await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForSelector('section.sec');
const loadMs = Date.now() - t0;
await page.waitForTimeout(800);
const result = await page.evaluate(
  () =>
    new Promise<{ intervals: number[]; height: number }>((resolve) => {
      const intervals: number[] = [];
      let last = performance.now();
      const start = last;
      const height = document.documentElement.scrollHeight;
      let y = 0;
      const step = () => {
        const now = performance.now();
        intervals.push(now - last);
        last = now;
        y = (y + 14) % Math.max(1, height - innerHeight);
        window.scrollTo(0, y);
        if (now - start < 4000) requestAnimationFrame(step);
        else resolve({ intervals: intervals.slice(1), height });
      };
      requestAnimationFrame(step);
    }),
);
await browser.close();
const s = [...result.intervals].sort((a, b) => a - b);
const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
const over = s.filter((x) => x > 25).length;
console.log(
  JSON.stringify(
    {
      base,
      path,
      reducedMotion: reduce,
      loadMs,
      documentHeight: result.height,
      frames: s.length,
      medianMs: Number(q(0.5).toFixed(1)),
      p95Ms: Number(q(0.95).toFixed(1)),
      maxMs: Number((s[s.length - 1] ?? 0).toFixed(1)),
      over25ms: over,
    },
    null,
    1,
  ),
);

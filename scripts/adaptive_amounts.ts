import { chromium } from 'playwright';

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
await expectText('/p/PRJAE25284478', '#p-value .big', 'USD 27.2 billion');

await browser.close();

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Adaptive USD headline checks: 4/4 passed');

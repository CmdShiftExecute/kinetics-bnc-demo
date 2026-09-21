import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const projectDir = path.resolve(import.meta.dirname, '../public/data/projects');
const values = readdirSync(projectDir)
  .filter((file) => file.endsWith('.json'))
  .flatMap((file) => JSON.parse(readFileSync(path.join(projectDir, file), 'utf8')).projects.map((project: { value: number }) => project.value))
  .sort((a, b) => a - b);

const q = (p: number) => values[Math.floor((values.length - 1) * p)]!;
const total = Math.round(values.reduce((sum, value) => sum + value, 0) * 10) / 10;
const checks: Array<[string, boolean, string]> = [
  ['register size', values.length === 3_500, `${values.length}`],
  ['p10 near the source shape', q(0.1) >= 0.5 && q(0.1) <= 2, `${q(0.1)}m`],
  ['median near the source shape', q(0.5) >= 12 && q(0.5) <= 18, `${q(0.5)}m`],
  ['p90 near the source shape', q(0.9) >= 220 && q(0.9) <= 320, `${q(0.9)}m`],
  ['largest project within the source maximum', values.at(-1)! <= 27_000, `${values.at(-1)}m`],
  ['whole register remains in billions', total >= 200_000 && total <= 600_000, `${total}m`],
];

for (const [name, pass, evidence] of checks) console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}: ${evidence}`);
const failures = checks.filter(([, pass]) => !pass);
if (failures.length) process.exit(1);


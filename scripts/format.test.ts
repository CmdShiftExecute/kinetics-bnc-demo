import { aedCompact, aedLabel } from '../src/lib/format';

const checks: Array<[string, string, string]> = [
  ['sub-billion compact', aedCompact(999.9), '999.9m'],
  ['sub-billion label', aedLabel(999.9), 'USD 999.9 million'],
  ['billion compact', aedCompact(53_688.4), '53.7bn'],
  ['billion label', aedLabel(155_762), 'USD 155.8 billion'],
  ['trillion compact', aedCompact(1_104_456.3), '1.10tn'],
  ['trillion label', aedLabel(1_104_456.3), 'USD 1.10 trillion'],
  ['negative compact', aedCompact(-1_250), '−1.3bn'],
  ['negative label', aedLabel(-1_250), '−USD 1.3 billion'],
];

const failures = checks.filter(([, actual, expected]) => actual !== expected);
for (const [name, actual, expected] of checks) {
  console.log(`${actual === expected ? 'PASS' : 'FAIL'}  ${name}: ${actual}`);
}

if (failures.length) {
  console.error(failures.map(([name, actual, expected]) => `${name}: expected ${expected}, got ${actual}`).join('\n'));
  process.exit(1);
}

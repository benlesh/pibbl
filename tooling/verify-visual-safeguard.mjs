import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineRoot = join(repositoryRoot, 'packages/core/test/visual-baselines');
const smokeArguments = [
  'packages/core/test/smoke-scenario.test.ts',
  '--browser.headless',
  '--browser.ui=false',
];
const artifacts = [
  'test-screenshots/dep-03/source/smoke.expected.png',
  'test-screenshots/dep-03/source/smoke.actual.png',
  'test-screenshots/dep-03/source/smoke.diff.png',
];

function baselineSnapshot() {
  return Object.fromEntries(
    readdirSync(baselineRoot)
      .filter(file => file.endsWith('.expected.png'))
      .sort()
      .map(file => [
        file,
        createHash('sha256').update(readFileSync(join(baselineRoot, file))).digest('hex'),
      ]),
  );
}

function runSmoke(environment = {}) {
  const result = spawnSync(
    'corepack',
    ['pnpm@11.21.0', 'exec', 'vitest', 'run', ...smokeArguments],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: { ...process.env, ...environment },
    },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { ...result, output };
}

function assertPassed(result, label) {
  if (result.status !== 0) {
    process.stderr.write(result.output);
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

const baselineBefore = baselineSnapshot();
assertPassed(runSmoke(), 'Initial visual check');

const drill = runSmoke({ VITE_CRC_VISUAL_DRILL: '1' });
if (drill.status === 0) {
  throw new Error('The deliberate visual regression unexpectedly passed.');
}
if (!drill.output.includes('Visual mismatch:') || !drill.output.includes('Inspect expected')) {
  process.stderr.write(drill.output);
  throw new Error('The deliberate visual regression failed without the expected mismatch diagnostic.');
}
for (const artifact of artifacts) {
  if (statSync(join(repositoryRoot, artifact)).size === 0) {
    throw new Error(`The visual safeguard produced an empty artifact: ${artifact}`);
  }
}
if (JSON.stringify(baselineSnapshot()) !== JSON.stringify(baselineBefore)) {
  throw new Error('A deliberate visual drill changed a committed baseline.');
}

assertPassed(runSmoke(), 'Visual recovery check');
if (JSON.stringify(baselineSnapshot()) !== JSON.stringify(baselineBefore)) {
  throw new Error('A normal visual check changed a committed baseline.');
}

process.stdout.write(
  'Visual safeguard rejected the drill, preserved every baseline byte, and recovered green.\n',
);

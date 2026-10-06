import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselineRoot = join(repositoryRoot, 'packages/core/test/visual-baselines');
const vitestEntry = join(repositoryRoot, 'node_modules/vitest/vitest.mjs');
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

let smokeCheck = 0;
function runSmoke(environment = {}, testFile = smokeArguments[0]) {
  const expectedFailure = Boolean(environment.VITE_PIBBL_VISUAL_DRILL || environment.VITE_PIBBL_DRAWING_VISUAL_DRILL);
  const result = spawnSync(
    process.execPath,
    [vitestEntry, 'run', testFile, ...smokeArguments.slice(1)],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        ...environment,
        PIBBL_TEST_REPORT_NAME: `Visual safeguard · check ${++smokeCheck} · ${testFile}`,
        // Deliberate regressions are verified by this script, not CI failures.
        ...(expectedFailure ? { GITHUB_ACTIONS: "false" } : {}),
      },
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

function readComparison() {
  return JSON.parse(readFileSync(join(repositoryRoot, 'test-screenshots/dep-03/source/smoke.diff.png.json'), 'utf8'));
}

const baselineBefore = baselineSnapshot();
assertPassed(runSmoke(), 'Initial visual check');
assert.equal(readComparison().status, 'match');

const drill = runSmoke({ VITE_PIBBL_VISUAL_DRILL: '1' });
if (drill.status === 0) {
  throw new Error('The deliberate visual regression unexpectedly passed.');
}
if (!drill.output.includes('Visual mismatch:') || !drill.output.includes('Inspect expected')) {
  process.stderr.write(drill.output);
  throw new Error('The deliberate visual regression failed without the expected mismatch diagnostic.');
}
const comparison = readComparison();
assert.equal(comparison.status, 'mismatch');
assert.ok(comparison.comparison.differentPixels > 0);
assert.ok(comparison.comparison.changedBounds.width > 0);
assert.ok(comparison.comparison.changedBounds.height > 0);
assert.equal(comparison.coordinateSpace, 'image-pixels');
for (const path of Object.values(comparison.artifacts)) assert.ok(statSync(resolve(repositoryRoot, path)).size > 0);
for (const artifact of artifacts) {
  if (statSync(join(repositoryRoot, artifact)).size === 0) {
    throw new Error(`The visual safeguard produced an empty artifact: ${artifact}`);
  }
}
if (JSON.stringify(baselineSnapshot()) !== JSON.stringify(baselineBefore)) {
  throw new Error('A deliberate visual drill changed a committed baseline.');
}

const maskDrill = runSmoke({ VITE_PIBBL_VISUAL_DRILL: 'mask-gap' });
assert.notEqual(maskDrill.status, 0, 'A 12×6 defect between text lines must not be hidden by text masks.');
const maskComparison = readComparison();
assert.equal(maskComparison.status, 'mismatch');
assert.equal(maskComparison.comparison.differentPixels, 72);
assert.deepEqual(maskComparison.comparison.changedBounds, { x: 60, y: 100, width: 12, height: 6 });

assertPassed(runSmoke(), 'Visual recovery check');
assert.equal(readComparison().status, 'match');
assert.equal(readComparison().comparison.changedBounds, null);
if (JSON.stringify(baselineSnapshot()) !== JSON.stringify(baselineBefore)) {
  throw new Error('A normal visual check changed a committed baseline.');
}

const galleryTest = 'packages/core/test/drawing-gallery.test.ts';
assertPassed(runSmoke({}, galleryTest), 'Initial gallery check');
for (const [drillName, slug, x, y] of [
  ['text-mask-gap', 'drawing-text', 40, 180],
  ['image-mask-background', 'drawing-images', 30, 50],
]) {
  const result = runSmoke({ VITE_PIBBL_DRAWING_VISUAL_DRILL: drillName }, galleryTest);
  assert.notEqual(result.status, 0, `Gallery mask hid ${drillName}.`);
  const report = JSON.parse(readFileSync(join(repositoryRoot, `test-screenshots/tfc-09/${slug}.diff.png.json`), 'utf8'));
  assert.equal(report.status, 'mismatch');
  assert.equal(report.comparison.differentPixels, 72);
  assert.deepEqual(report.comparison.changedBounds, { x, y, width: 12, height: 6 });
}
const inkDrill = runSmoke({ VITE_PIBBL_DRAWING_VISUAL_DRILL: 'omit-text-ink' }, galleryTest);
assert.notEqual(inkDrill.status, 0, 'Recorded text commands without visible glyphs must fail.');
assert.ok(inkDrill.output.includes('visible glyph ink in region'), 'Glyph omission must fail on independent pixel evidence.');
assertPassed(runSmoke({}, galleryTest), 'Gallery recovery check');
assert.deepEqual(baselineSnapshot(), baselineBefore, 'Gallery checks must preserve baseline bytes.');

process.stdout.write(
  'Visual safeguard rejected the drill, preserved every baseline byte, and recovered green.\n',
);

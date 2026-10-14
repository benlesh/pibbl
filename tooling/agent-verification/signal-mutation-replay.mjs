import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { sourceSignalMutationIdentity } from './signal-mutation-identity.mjs';
import { assertIdentity } from './identity.mjs';
import { reserveEvidenceDirectory } from './evidence-directory.mjs';
import { createCheckpointWriter } from './checkpoint.mjs';
import { createReplayManifest, captureReplayToolIdentity, finalizeReplayToolIdentity, capturePageEnvironment } from './run-manifest.mjs';
import { recordAssertion } from './recorded-check.mjs';
import { finalizeReplayOutcome } from './replay-outcome.mjs';
import { recordReplayFailure } from './failure-evidence.mjs';
const repository = resolve(import.meta.dirname, '../..');
const url = process.argv[2];
if (!url) throw new Error('Provide the source Studio signal-mutation URL.');
const output = resolve(process.argv[3] ?? `${repository}/packages/core/test/out/agent-signal-mutation/${new Date().toISOString().replaceAll(':', '-')}`);
await reserveEvidenceDirectory(output);
// Independent intended values, revision increments and diagnosis for this sequence.
const recipe = [
  ['initial', null, 10, 10, 'pass', 'application-observation', 0, 0],
  ['intentional-noop', 'equal-noop', 10, 10, 'pass', 'intentional-equal-write', 0, 0],
  ['mutation', 'in-place', 42, 10, 'fail', 'same-reference-mutation-suppressed', 0, 0],
  ['repeat-mutation', 'in-place', 42, 10, 'fail', 'equal-write-keeps-stale-display', 0, 0],
  ['replacement', 'replace', 42, 42, 'pass', 'replacement-published', 1, 1],
  ['reset', 'reset', 10, 10, 'pass', 'application-observation', 2, 2],
];
const subjects = ['application-intent', 'equality-diagnosis', 'publication-evaluation', 'bounded-window', 'bar-pixels'];
const report = { schema: 'crc-signal-mutation-replay/1', status: 'incomplete', url,
  requiredChecks: recipe.flatMap(([actionId]) => subjects.map(subject => ({ actionId, checkId: `${actionId}.${subject}` }))),
  scope: 'Explicit default Object.is fixture; bounded two-frame observation, not a universal deep mutation detector.', steps: [], errors: [], droppedErrors: 0 };
const checkpoint = createCheckpointWriter(output);
report.run = createReplayManifest({ repository, kind: 'signal-mutation', url, runId: checkpoint.runId });
let browser;
try {
  report.expectedIdentity = await sourceSignalMutationIdentity(repository);
  report.run.toolIdentity = await captureReplayToolIdentity(repository, 'signal-mutation', report.expectedIdentity.revision);
  await checkpoint(report, 'setup');
  browser = await chromium.launch({ timeout: 15000 }); report.browser = browser.version();
  const page = await browser.newPage(report.run.environment.browserContext);
  page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', error => { if (report.errors.length < 16) report.errors.push(error.message.slice(0, 1000)); else report.droppedErrors++; });
  await page.goto(url);
  report.run.environment.observedPage = await capturePageEnvironment(page);
  let baseVersion, baseEvaluations;
  const evidence = page.getByTestId('agent-signal-mutation-evidence');
  for (const [index, [actionId, action, source, evaluated, assertion, diagnosis, versionDelta, evaluationDelta]] of recipe.entries()) {
    if (action) await page.locator(`[data-scenario-action="${action}"]`).click();
    await page.waitForFunction(revision => {
      const raw = document.querySelector('[data-testid="agent-signal-mutation-evidence"]')?.textContent;
      if (!raw || raw.length > 16384) return false;
      const state = JSON.parse(raw).state;
      return state?.status === 'ready' && state.revision === revision;
    }, index + 1);
    const raw = await evidence.textContent(); assert.ok(raw && Buffer.byteLength(raw) < 16384, 'Bounded fixture evidence required.');
    const envelope = JSON.parse(raw); assert.equal(envelope.schema, 'crc-signal-mutation-fixture/1');
    assertIdentity(report.expectedIdentity, envelope.identity);
    const state = envelope.state;
    const step = { actionId, action: action ?? 'mount', status: 'incomplete', transport: action ? 'native-playwright-pointer' : 'page-navigation' };
    report.steps.push(step); await checkpoint(report, actionId);
    const check = (subject, assertion) => recordAssertion(report, { actionId, checkId: `${actionId}.${subject}` }, assertion);
    await check('application-intent', () => {
      assert.equal(state.sourceAmount, source); assert.equal(state.expectedAmount, source);
      assert.equal(state.evaluatedAmount, evaluated); assert.equal(state.assertion, assertion);
    });
    await check('equality-diagnosis', () => { assert.equal(state.equality.policy, 'Object.is-default'); assert.equal(state.diagnosis, diagnosis); assert.equal(state.equality.sameReference, ['equal-noop', 'in-place'].includes(action)); });
    if (index === 0) {
      assert.ok(Number.isSafeInteger(state.signalVersion) && state.signalVersion >= 0);
      assert.ok(Number.isSafeInteger(state.componentEvaluations) && state.componentEvaluations >= 1);
      baseVersion = state.signalVersion; baseEvaluations = state.componentEvaluations;
    }
    await check('publication-evaluation', () => { assert.equal(state.signalVersion, baseVersion + versionDelta); assert.equal(state.componentEvaluations, baseEvaluations + evaluationDelta); });
    await check('bounded-window', () => assert.deepEqual(state.observationWindow, { kind: 'two-host-animation-frames', completedFrames: 2, scope: 'finite-observation-not-future-guarantee' }));
    const pixel = await page.getByTestId('scenario-canvas').evaluate(canvas => {
      // Independent transform from the fixture's explicit 480x180 contain viewport.
      const scale = Math.min(canvas.clientWidth / 480, canvas.clientHeight / 180);
      const x = Math.floor(((canvas.clientWidth - 480 * scale) / 2 + 200 * scale) * canvas.width / canvas.clientWidth);
      const y = Math.floor(((canvas.clientHeight - 180 * scale) / 2 + 80 * scale) * canvas.height / canvas.clientHeight);
      return { rgba: [...canvas.getContext('2d').getImageData(x, y, 1, 1).data], backingPoint: { x, y }, backingSize: { width: canvas.width, height: canvas.height }, displaySize: { width: canvas.clientWidth, height: canvas.clientHeight } }; 
    });
    await check('bar-pixels', () => { if (evaluated === 42) assert.deepEqual(pixel.rgba, [37, 99, 235, 255]); else assert.equal(pixel.rgba[3], 0); });
    step.state = state; step.pixel = { logicalPoint: { x: 200, y: 80 }, ...pixel, viewport: { width: 480, height: 180, fit: 'contain' }, capture: 'active-single-pixel-readback' };
    step.status = 'pass'; await checkpoint(report, `${actionId}:complete`);
  }
  assert.deepEqual(report.errors, []);
  assertIdentity(report.expectedIdentity, await sourceSignalMutationIdentity(repository));
  report.status = 'pass';
} catch (error) { recordReplayFailure(report, error); process.exitCode = 1; }
finally {
  try { await browser?.close(); } catch (error) { recordReplayFailure(report, error); process.exitCode = 1; }
  await finalizeReplayToolIdentity(report, repository);
  if (!finalizeReplayOutcome(report, recipe.map(([id]) => id))) process.exitCode = 1;
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${report.status}: ${resolve(output, 'report.json')}\n`);
}

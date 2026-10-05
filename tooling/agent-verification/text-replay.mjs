/** Native Studio replay; text evidence is validated before entering retained reports. */
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { sourceTextIdentity } from './text-identity.mjs';
import { assertIdentity } from './identity.mjs';
import { reserveEvidenceDirectory } from './evidence-directory.mjs';
import { createCheckpointWriter } from './checkpoint.mjs';
import { createReplayManifest, captureReplayToolIdentity, finalizeReplayToolIdentity, capturePageEnvironment } from './run-manifest.mjs';
import { recordAssertion } from './recorded-check.mjs';
import { finalizeReplayOutcome } from './replay-outcome.mjs';

const repository = resolve(import.meta.dirname, '../..');
const url = process.argv[2];
if (!url) throw new Error('Provide the source Studio text-verification URL.');
const output = resolve(process.argv[3] ?? `${repository}/packages/core/test/out/agent-text/${new Date().toISOString().replaceAll(':', '-')}`);
await reserveEvidenceDirectory(output);
const actions = ['initial', 'repair', 'seed'];
const subjects = ['ready-revision', 'exact-fixture-label', 'private-text-redacted', 'bounded-call-evidence'];
const report = { schema: 'pibbl-text-replay/1', status: 'incomplete', url,
  requiredChecks: actions.flatMap(actionId => subjects.map(subject => ({ actionId, checkId: `${actionId}.${subject}` }))),
  steps: [], errors: [], droppedErrors: 0,
  scope: 'Native Studio action buttons and successful single-context text calls; no glyph visibility or other-surface claim.' };
const checkpoint = createCheckpointWriter(output);
report.run = createReplayManifest({ repository, kind: 'text', url, runId: checkpoint.runId });
let browser;
let stage = 'setup';
try {
  report.expectedIdentity = await sourceTextIdentity(repository);
  report.run.toolIdentity = await captureReplayToolIdentity(repository, 'text', report.expectedIdentity.revision);
  await checkpoint(report, stage);
  browser = await chromium.launch({ timeout: 15000 });
  report.browser = browser.version();
  const page = await browser.newPage(report.run.environment.browserContext);
  page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', () => { if (report.errors.length < 16) report.errors.push('Browser page error (message redacted).'); else report.droppedErrors++; });
  stage = 'navigation'; await page.goto(url);
  report.run.environment.observedPage = await capturePageEnvironment(page);
  const evidence = page.getByTestId('agent-text-evidence');
  for (const [index, actionId] of actions.entries()) {
    stage = actionId;
    if (actionId !== 'initial') await page.locator(`[data-scenario-action="${actionId}"]`).click();
    const revision = index + 1;
    await page.waitForFunction(revision => {
      const text = document.querySelector('[data-testid="agent-text-evidence"]')?.textContent;
      if (!text || text.length > 8192) return false;
      try { const state = JSON.parse(text).state; return state?.status === 'ready' && state.revision === revision; }
      catch { return false; }
    }, revision);
    const raw = await evidence.textContent();
    assert.ok(raw && Buffer.byteLength(raw) < 8192, 'Fixture evidence must fit its byte budget.');
    let envelope;
    try { envelope = JSON.parse(raw); } catch { throw new Error('Invalid text evidence JSON (content redacted).'); }
    assert.ok(envelope.schema === 'pibbl-text-fixture/1', 'Unexpected text evidence schema.');
    assertIdentity(report.expectedIdentity, envelope.identity);
    const state = envelope.state;
    const step = { actionId, status: 'incomplete', transport: actionId === 'initial' ? 'page-navigation' : 'native-playwright-pointer' };
    report.steps.push(step);
    const check = (subject, predicate) => recordAssertion(report, { actionId, checkId: `${actionId}.${subject}` }, () => assert.ok(predicate, `Text check failed: ${subject}; actual payload redacted.`));
    const mode = actionId === 'repair' ? 'repair' : 'seed';
    const label = mode === 'repair' ? 'Revenue: 42' : 'Revenue: 24';
    await check('ready-revision', state?.status === 'ready' && state.revision === revision && state.mode === mode && state.assertion === (mode === 'repair' ? 'pass' : 'fail') && state.expected === 'Revenue: 42');
    await check('exact-fixture-label', isDeepStrictEqual(state.observation?.records?.[0]?.content, { status: 'fixture', value: label }));
    await check('private-text-redacted', isDeepStrictEqual(state.observation?.records?.[1]?.content, { status: 'redacted' }));
    const record = (sequence, content, y) => ({ sequence, operation: 'fillText', content, x: 24, y, maxWidth: null, alignment: 'left', baseline: 'top' });
    const expected = { mode, status: 'ready', revision, expected: 'Revenue: 42', assertion: mode === 'repair' ? 'pass' : 'fail',
      observation: { schema: 'pibbl-text-call-evidence/1', status: 'stopped', scope: 'one-context-successful-calls', geometry: 'draw-positions-not-glyph-bounds', fontAttribution: 'unknown', fontRequest: 'not-recorded', clipping: 'not-observed', pixels: 'not-observed', observationFailures: 0, completeness: 'complete', total: 2, dropped: 0, capacity: 8,
        records: [record(1, { status: 'fixture', value: label }, 48), record(2, { status: 'redacted' }, 88)] } };
    await check('bounded-call-evidence', isDeepStrictEqual(state, expected));
    // Only the fully validated payload reaches retained evidence; no screenshots
    // or browser error strings can bypass this text-specific redaction boundary.
    step.state = state; step.status = 'pass'; await checkpoint(report, `${stage}:complete`);
  }
  assert.ok(report.errors.length === 0 && report.droppedErrors === 0, 'Unexpected browser errors.');
  assertIdentity(report.expectedIdentity, await sourceTextIdentity(repository));
  report.status = 'pass';
} catch (error) {
  report.status = error?.code?.startsWith('PIBBL_FIXTURE_IDENTITY') ? 'blocked' : 'fail';
  report.failure = { stage, reason: 'Text verification did not complete; unvalidated payload and error details redacted.', code: error?.code?.startsWith('PIBBL_FIXTURE_IDENTITY') ? error.code : null };
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } catch { report.status = 'fail'; report.cleanupFailure = 'Browser cleanup failed (details redacted).'; }
  await finalizeReplayToolIdentity(report, repository);
  if (!finalizeReplayOutcome(report, actions)) process.exitCode = 1;
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${report.status}: ${resolve(output, 'report.json')}\n`);
}

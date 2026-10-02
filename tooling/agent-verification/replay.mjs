import { requiredReplayChecks } from './required-checks.mjs';
import { recordAssertion } from './recorded-check.mjs';
import { assertNativeDeliveryProvenance } from './input-provenance.mjs';
import { reserveEvidenceDirectory } from './evidence-directory.mjs';
import { describeReplayError, recordReplayFailure } from './failure-evidence.mjs';
import { capturePageEnvironment, createReplayManifest, captureReplayToolIdentity, finalizeReplayToolIdentity } from './run-manifest.mjs';
import { createCheckpointWriter } from './checkpoint.mjs';
import { finalizeReplayOutcome } from './replay-outcome.mjs';
import { observeBrowserFailure } from './browser-failure.mjs';
import { sourceIdentity, assertIdentity } from './identity.mjs';
/** Native browser counterpart to the internal Studio fixture; no UI prose parsing. */
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const repository = resolve(import.meta.dirname, '../..');
const url = process.argv[2] ?? 'http://127.0.0.1:5193/#/testing/agent-targeting-verification';
const output = resolve(process.argv[3] ?? `${repository}/packages/core/test/out/agent-targeting/${new Date().toISOString().replaceAll(':', '-')}`);
await reserveEvidenceDirectory(output);
const report = {
  requiredChecks: requiredReplayChecks('targeting'),
  schema: 'crc-targeting-replay/1', status: 'incomplete', url,
  node: process.version, browser: null, timestamp: new Date().toISOString(),
  environment: { viewport: { width: 1280, height: 1000 }, density: 1, locale: 'en-US', timezone: 'UTC' },
  provenanceScope: 'Loaded fixture marker compared with local core source, fixture, inspector, development configuration and lockfile; not full dependency or asset attestation.',
  oracle: { point: { x: 144, y: 112 }, expectedColor: [37, 99, 235, 255], requiredSelection: 'item-a' },
  steps: [], errors: [], droppedErrors: 0,
  checks: [
    { checkId: 'protected-action-permissions', status: 'not-applicable', required: false, reason: 'This controlled fixture invokes no clipboard, fullscreen or other permission-gated action.' },
    { checkId: 'real-hardware-input', status: 'skipped', required: false, reason: 'This run uses Playwright Chromium automation; physical touch/pen hardware is not exercised.' },
  ],
};
const checkpoint = createCheckpointWriter(output);
report.checkpointRunId = checkpoint.runId;
report.run = createReplayManifest({ runId: checkpoint.runId, repository, kind: 'targeting', url, density: 1 });
let browser;
let browserFailure;
let stage = 'setup';
let failed = false;
try {
  await checkpoint(report, 'setup');
  const sourceFiles = ['tooling/agent-verification/targeting.ts', 'tooling/agent-verification/replay.mjs',
    'packages/scenarios/src/agent-targeting-verification.example.tsx', 'packages/scenarios/src/agent-targeting-verification.ts'];
  const hash = createHash('sha256');
  for (const file of sourceFiles) hash.update(file).update(await readFile(resolve(repository, file)));
  report.localSource = {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repository, encoding: 'utf8' }).trim(),
    sourceFiles, sha256: hash.digest('hex'),
  };
  report.expectedIdentity = await sourceIdentity(repository);
  report.run.toolIdentity = await captureReplayToolIdentity(repository, 'targeting', report.expectedIdentity.revision);
  browser = process.env.CRC_VERIFY_BROWSER_ENDPOINT
    ? await chromium.connect(process.env.CRC_VERIFY_BROWSER_ENDPOINT, { timeout: 15000 })
    : await chromium.launch({ timeout: 15_000 });
  report.browser = browser.version();
  const page = await browser.newPage(report.run.environment.browserContext);
  browserFailure = observeBrowserFailure(browser, page);
  page.setDefaultTimeout(10_000);
  page.setDefaultNavigationTimeout(15_000);
  page.on('pageerror', error => {
    if (report.errors.length < 16) report.errors.push(error.message.slice(0, 1000));
    else report.droppedErrors++;
  });
  stage = 'navigation';
  await checkpoint(report, stage);
  await page.goto(url);
  report.run.environment.observedPage = await capturePageEnvironment(page);
  const evidence = page.getByTestId('agent-targeting-evidence');
  await evidence.waitFor({ state: 'attached' });
  const readEvidence = async () => {
    const text = await evidence.textContent();
    assert.ok(text && text.length <= 65_536, 'Fixture evidence must be present and bounded.');
    const parsed = JSON.parse(text);
    assert.equal(parsed.schema, 'crc-targeting-fixture/1');
    report.servedIdentity = parsed.identity ?? null;
    assertIdentity(report.expectedIdentity, parsed.identity);
    return parsed.state;
  };
  const waitState = (field, value) => page.waitForFunction(({ field, value }) => {
    const element = document.querySelector('[data-testid="agent-targeting-evidence"]');
    if (!element?.textContent) return false;
    const state = JSON.parse(element.textContent).state;
    return field === 'inspection' ? state.inspection.status === value : state[field] === value;
  }, { field, value });
  await page.waitForFunction(() => !!document.querySelector('[data-testid="agent-targeting-evidence"]')?.textContent, undefined, { timeout: 10_000 });
  const initial = await readEvidence();
  report.runtimeCompatibility = initial.runtimeCompatibility;
  assert.equal(initial.runtimeCompatibility?.status, 'accepted');
  assert.equal(initial.runtimeCompatibility.diagnostic.relation, 'same-runtime');
  assert.equal(initial.runtimeCompatibility.diagnostic.versions, 'matching');
  assert.equal(initial.inspectionAvailability, 'source-runtime', 'Inspection is unavailable in this build; use the source development Studio.');
  assert.equal(initial.schedulerHistory, null);
  await page.locator('[data-scenario-action="capture-sources"]').click();
  const sourceCapture = await readEvidence();
  const locations = sourceCapture.signalInspection.ownership.components.records.map(record => record.source);
  assert.ok(locations.some(source => source.status === 'available' && source.fileName.endsWith('agent-targeting-verification.example.tsx') && source.lineNumber > 0));
  assert.equal(sourceCapture.renderCount, initial.renderCount);
  await page.locator('[data-scenario-action="trace-start"]').click();
  const canvas = page.getByTestId('scenario-canvas');
  for (const [mode, action, delivery, selected] of [
    ['seed', null, 'decoration', null], ['repair', 'repair', 'action', 'item-a'],
    ['intentional-block', 'intentional-block', 'decoration', null],
  ]) {
    stage = mode;
    const step = { actionId: mode, mode, expectedApplicationOutcome: mode === 'seed' ? 'fail-selection-requirement' : 'satisfy-mode-requirement', status: 'incomplete', transport: 'native-playwright-pointer' };
    report.steps.push(step);
    await checkpoint(report, stage);
    if (action) { await page.locator(`[data-scenario-action="${action}"]`).click(); await waitState('mode', mode); }
    await page.locator('[data-scenario-action="inspect"]').click();
    await waitState('inspection', 'ready');
    const prediction = await readEvidence();
    step.prediction = prediction;
    for (const space of ['backing', 'cssContent']) {
      assert.equal(prediction.coordinateMappings[space].status, 'mapped');
      assert.deepEqual(prediction.coordinateMappings[space].generation, prediction.inspection.generation);
      assert.deepEqual(prediction.coordinateMappings[space].value, report.oracle.point);
    }
    assert.equal(prediction.inspection.surface.status, 'available');
    assert.equal(prediction.inspection.surface.geometry.configuredPixelRatio, 1);
    assert.deepEqual(prediction.inspection.surface.geometry.logical, { width: 480, height: 240 });
    assert.deepEqual(prediction.inspection.surface.geometry.cssContent, { width: 480, height: 240 });
    assert.deepEqual(prediction.inspection.surface.geometry.backing, { width: 480, height: 240 });
    assert.deepEqual(prediction.inspection.surface.geometry.logicalToBacking, [1, 0, 0, 1, 0, 0]);
    assert.deepEqual(prediction.inspection.surface.geometry.backingToLogical, [1, 0, 0, 1, 0, 0]);
    assert.equal(prediction.probe.status, 'target');
    step.pixel = await canvas.evaluate(canvas => [...canvas.getContext('2d').getImageData(144, 112, 1, 1).data]);
    await recordAssertion(report, { checkId: `${mode}.pixels`, actionId: mode }, () => assert.deepEqual(step.pixel, report.oracle.expectedColor));
    await canvas.click({ position: report.oracle.point });
    await waitState('deliveredTo', delivery);
    const actual = await readEvidence();
    step.actual = actual;
    assert.equal(actual.eventTrace.scope, 'wrapped-handlers-only');
    assert.equal(actual.eventTrace.identityScope, 'trace-local');
    const eventRecords = actual.eventTrace.records.slice(-6);
    assert.deepEqual(eventRecords.map(record => [record.label, record.stage, record.phase]), [
      ['scene-capture', 'enter', 1], ['scene-capture', 'return', 1],
      [delivery, 'enter', 2], [delivery, 'return', 2],
      ['scene-bubble', 'enter', 3], ['scene-bubble', 'return', 3],
    ]);
    assert.equal(new Set(eventRecords.map(record => record.eventId)).size, 1);
    assert.ok(eventRecords.every(record => record.original.isTrusted && record.type === 'click'));
    assert.equal(eventRecords[0].targetId, eventRecords[2].currentTargetId);
    assert.equal(eventRecords[0].currentTargetId, eventRecords[4].currentTargetId);
    await recordAssertion(report, { checkId: `${mode}.input-provenance`, actionId: mode }, () => assertNativeDeliveryProvenance(actual.delivery.input, 'pointer'));
    await recordAssertion(report, { checkId: `${mode}.selected-entity`, actionId: mode }, () => assert.equal(actual.selectedItem, selected));
    await recordAssertion(report, { checkId: `${mode}.selection-count`, actionId: mode }, () => assert.equal(actual.selections, mode === 'repair' ? 1 : 0));
    await recordAssertion(report, { checkId: `${mode}.delivery-generation`, actionId: mode }, () => assert.deepEqual(actual.delivery.generation, prediction.inspection.generation));
    await recordAssertion(report, { checkId: `${mode}.delivery-target`, actionId: mode }, () => assert.equal(actual.delivery.targetId, prediction.probe.targetId));
    await recordAssertion(report, { checkId: `${mode}.selection-intent`, actionId: mode }, () => assert.equal(actual.expectedSelection, mode !== 'intentional-block'));
    await page.locator('[data-scenario-action="inspect"]').click();
    const observed = await readEvidence();
    step.schedulerHistory = observed.schedulerHistory;
    assert.equal(step.schedulerHistory.status, 'recording');
    const frameSummary = step.schedulerHistory.frames.at(-1);
    assert.equal(frameSummary.completeness, 'complete');
    assert.equal(frameSummary.missingStart, false);
    assert.equal(frameSummary.missingEnd, false);
    assert.equal(frameSummary.commitApplied, true);
    assert.ok(Object.values(frameSummary.phaseErrors).every(value => value === 0));
    const phases = step.schedulerHistory.records.slice(-7);
    assert.deepEqual(phases.map(record => record.phase), ['begin', 'advance', 'commit', 'plan', 'render', 'complete', 'idle']);
    assert.equal(new Set(phases.map(record => record.frameId)).size, 1);
    assert.equal(phases.at(-1).outcome, 'no-collected-errors');
    assert.equal(phases.at(-1).errorCount, 0);
    assert.ok(phases.every(record => record.collectedErrors === 0));
    assert.ok(phases.slice(0, -1).every(record => record.outcome === null && record.errorCount === null));
    step.signalEvidence = observed.signalInspection;
    assert.equal(step.signalEvidence.schema, 'crc-signal-observation/1');
    assert.equal(step.signalEvidence.scheduler.schema, 'crc-scheduler-observation/1');
    assert.equal(step.signalEvidence.scheduler.scope, 'loaded-runtime-realm');
    assert.equal(step.signalEvidence.scheduler.phase, 'idle');
    assert.equal(step.signalEvidence.scheduler.frame, null);
    assert.equal(step.signalEvidence.scheduler.applicationReadiness, 'unknown');
    assert.ok(step.signalEvidence.scheduler.work.registeredRoots >= 1);
    assert.equal(step.signalEvidence.records.length, 6);
    assert.deepEqual(step.signalEvidence.records[5].dependencies.edges.map(edge => edge.sourceId), mode === 'intentional-block' ? [1] : [1, 2]);
    assert.equal(step.signalEvidence.records[2].preview.value, mode === 'repair' ? 1 : 0);
    assert.equal(step.signalEvidence.ownership.completeness, 'complete');
    const components = step.signalEvidence.ownership.components;
    assert.equal(components.completeness, 'complete');
    assert.ok(components.records.some(record => record.hasSignalConsumer === false));
    assert.equal(components.records.filter(record => record.label?.value === 'targeting-scene' && record.label.uniqueness === 'unique').length, 1);
    assert.equal(new Set(components.records.map(record => record.componentId)).size, components.records.length);
    const componentIds = new Set(components.records.map(record => record.componentId));
    assert.ok(components.records.some(record => record.surfaceKind === 'layer' && record.surfaceHost.status === 'observed'));
    for (const record of components.records) {
      for (const relation of [record.componentParent, record.surfaceHost]) {
        if (relation.status === 'observed') assert.ok(componentIds.has(relation.componentId));
        else assert.equal(relation.componentId, null);
      }
    }
    const selectedObservers = step.signalEvidence.records[1].observers;
    assert.equal(selectedObservers.completeness, 'complete');
    assert.ok(selectedObservers.records.some(observer => observer.kind === 'render'));
    assert.deepEqual(selectedObservers.records.filter(observer => observer.kind === 'computed').map(observer => observer.registeredSignalId), mode === 'intentional-block' ? [] : [6]);
    for (const record of step.signalEvidence.records) {
      for (const observer of record.observers.records) if (observer.kind === 'render') {
        assert.equal(observer.dirty, false);
        assert.ok(observer.owner?.componentId);
        assert.ok(observer.owner.surfaceId > 0);
        assert.equal(observer.owner.requestedRevision, observer.owner.completedRevision);
      }
    }
    assert.equal(step.signalEvidence.records[4].cache, 'never-read');
    assert.equal(observed.dormantMetricEvaluations, 0);
    step.screenshot = `${mode}.png`;
    await page.locator('.scenario-runner__visual').screenshot({ path: resolve(output, step.screenshot) });
    step.status = 'pass';
    await checkpoint(report, `${stage}:complete`);
  }
  await page.locator('[data-scenario-action="trace-stop"]').click();
  assert.equal((await readEvidence()).schedulerHistory.status, 'stopped');
  stage = 'outside-layer';
  const outside = { actionId: 'outside-layer', mode: 'outside-layer', point: { x: 300, y: 112 }, status: 'incomplete', transport: 'native-playwright-pointer' };
  report.steps.push(outside);
    await checkpoint(report, stage);
  await page.locator('[data-scenario-action="seed"]').click();
  await waitState('mode', 'seed');
  await page.locator('[data-scenario-action="inspect-outside-layer"]').click();
  await waitState('inspection', 'ready');
  outside.prediction = await readEvidence();
  assert.deepEqual(outside.prediction.probePoint, outside.point);
  assert.equal(outside.prediction.probe.status, 'miss');
  assert.equal(outside.prediction.probe.candidates.length, 2);
  for (const candidate of outside.prediction.probe.candidates) {
    assert.equal(candidate.outcome, 'clip-excluded');
    assert.equal(candidate.exclusion.kind, 'surface-bounds');
    assert.equal(candidate.exclusion.entryOrder, 0);
  }
  await canvas.click({ position: outside.point });
  outside.actual = await readEvidence();
  assert.equal(outside.actual.deliveredTo, null);
  assert.equal(outside.actual.selectedItem, null);
  assert.equal(outside.actual.selections, 0);
  outside.screenshot = 'outside-layer.png';
  await page.locator('.scenario-runner__visual').screenshot({ path: resolve(output, outside.screenshot) });
  outside.status = 'pass';
    await checkpoint(report, `${stage}:complete`);
  stage = 'capture-drag';
  const captured = { actionId: 'capture-drag', mode: 'capture-drag', status: 'incomplete', transport: 'native-playwright-pointer' };
  report.steps.push(captured);
    await checkpoint(report, stage);
  await page.locator('[data-scenario-action="capture-drag"]').click();
  await waitState('mode', 'capture-drag');
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox(); assert.ok(box);
  await page.mouse.move(box.x + 144, box.y + 112);
  await page.mouse.down();
  try {
    await page.mouse.move(box.x + 300, box.y + 112);
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="agent-targeting-evidence"]');
      return element?.textContent && JSON.parse(element.textContent).state.capturedDelivery?.x === 300;
    });
    captured.actual = await readEvidence();
    assert.equal(captured.actual.probe.status, 'miss');
    assert.equal(captured.actual.probe.routing, 'geometry-only');
    const owner = captured.actual.capturedDelivery;
    assert.deepEqual(captured.actual.inspection.pointerCapture.records, [{ pointerId: owner.pointerId, targetId: owner.targetId, live: true }]);
  } finally { await page.mouse.up(); }
  await page.locator('[data-scenario-action="inspect"]').click();
  captured.released = await readEvidence();
  assert.deepEqual(captured.released.inspection.pointerCapture.records, []);
  captured.status = 'pass';
    await checkpoint(report, `${stage}:complete`);
  stage = 'dom-overlay';
  const overlay = { actionId: 'dom-overlay', mode: 'dom-overlay', status: 'incomplete', transport: 'native-playwright-pointer' };
  report.steps.push(overlay);
    await checkpoint(report, stage);
  await page.locator('[data-scenario-action="dom-overlay"]').click();
  await waitState('mode', 'repair');
  await page.locator('[data-scenario-action="inspect"]').click();
  overlay.prediction = await readEvidence();
  assert.equal(overlay.prediction.probe.status, 'target');
  await canvas.scrollIntoViewIfNeeded();
  const overlayBox = await canvas.boundingBox(); assert.ok(overlayBox);
  await page.mouse.click(overlayBox.x + 144, overlayBox.y + 112);
  await waitState('domOverlayClicks', 1);
  overlay.blocked = await readEvidence();
  assert.equal(overlay.blocked.browserProbe.status, 'blocked');
  assert.equal(overlay.blocked.selectedItem, null);
  await page.locator('[data-scenario-action="remove-dom-overlay"]').click();
  await canvas.click({ position: report.oracle.point });
  await waitState('selectedItem', 'item-a');
  overlay.repaired = await readEvidence();
  assert.equal(overlay.repaired.selections, 1);
  overlay.status = 'pass';
    await checkpoint(report, `${stage}:complete`);
  stage = 'keyboard-focus';
  const focus = { actionId: 'keyboard-focus', mode: 'keyboard-focus', status: 'incomplete', transport: 'native-playwright-keyboard' };
  report.steps.push(focus);
    await checkpoint(report, stage);
  await page.locator('[data-scenario-action="keyboard-focus"]').click();
  await waitState('mode', 'keyboard-focus');
  await canvas.click({ position: report.oracle.point });
  await waitState('selections', 1);
  focus.pointerPixel = await canvas.evaluate(canvas => [...canvas.getContext('2d').getImageData(76, 80, 1, 1).data]);
  assert.deepEqual(focus.pointerPixel, [248, 250, 252, 255]);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await waitState('selections', 2);
  await page.waitForFunction(() => {
    const element = document.querySelector('[data-testid="agent-targeting-evidence"]');
    if (!element?.textContent) return false;
    const state = JSON.parse(element.textContent).state;
    return state.inspection.focus?.nativeFocus === 'canvas' && state.inspection.focus?.targetId === state.delivery.targetId && state.inspection.focus?.visible === true;
  });
  focus.actual = await readEvidence();
  assertNativeDeliveryProvenance(focus.actual.delivery.input, 'keyboard');
  assert.equal(focus.actual.focusObservationError, null);
  assert.equal(focus.actual.selectedItem, 'item-a');
  assert.equal(focus.actual.inspection.focus.status, 'ready');
  assert.equal(focus.actual.inspection.focus.records.length, 1);
  assert.equal(focus.actual.inspection.focus.visible, true);
  focus.keyboardPixel = await canvas.evaluate(canvas => [...canvas.getContext('2d').getImageData(76, 80, 1, 1).data]);
  assert.deepEqual(focus.keyboardPixel, [255, 0, 255, 255]);
  await page.locator('[data-scenario-action="inspect"]').click();
  const comparisonEvidence = await readEvidence();
  focus.componentRemovals = comparisonEvidence.signalInspection.ownership.components.removals;
  focus.componentChanges = comparisonEvidence.componentChanges;
  assert.equal(focus.componentChanges.status, 'ready');
  assert.ok(focus.componentChanges.changes.some(change => change.kind === 'added'));
  assert.ok(focus.componentChanges.changes.some(change => change.kind === 'removed'));
  assert.equal(focus.componentRemovals.scope, 'previous-snapshot-handles');
  assert.ok(focus.componentRemovals.records.length > 0);
  assert.ok(focus.componentRemovals.records.every(record => record.reason === 'component-disposed'));
  focus.status = 'pass';
    await checkpoint(report, `${stage}:complete`);
  stage = 'scene-pagination';
  const pagination = { actionId: stage, status: 'incomplete', pages: [], transport: 'native-playwright-pointer' };
  report.steps.push(pagination); await checkpoint(report, stage);
  await page.locator('[data-scenario-action="pagination-scene"]').click();
  await waitState('mode', 'pagination');
  await page.locator('[data-scenario-action="scene-page-first"]').click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="agent-targeting-evidence"]').textContent).state.scenePage?.status === 'ready');
  let sceneState = await readEvidence();
  const initialPage = sceneState.scenePage;
  const initialRenderCount = sceneState.renderCount;
  // The fixed fixture adds 100 separate target paths to the existing three entries.
  assert.equal(initialPage.totalRecords, 103);
  for (let index = 0; index < 4; index++) {
    const observed = sceneState.scenePage;
    pagination.pages.push(observed);
    assert.equal(observed.status, 'ready'); assert.equal(observed.completeness, 'complete');
    assert.deepEqual(observed.generation, initialPage.generation);
    assert.equal(sceneState.renderCount, initialRenderCount);
    assert.equal(sceneState.dormantMetricEvaluations, 0);
    if (index < 3) {
      assert.ok(observed.nextCursor);
      await page.locator('[data-scenario-action="scene-page-next"]').click();
      await page.waitForFunction(order => JSON.parse(document.querySelector('[data-testid="agent-targeting-evidence"]').textContent).state.scenePage?.records[0]?.order === order, (index + 1) * 32);
      sceneState = await readEvidence();
    }
  }
  const records = pagination.pages.flatMap(item => item.records);
  assert.deepEqual(records.map(record => record.order), Array.from({ length: 103 }, (_, index) => index));
  assert.equal(pagination.pages[3].nextCursor, null);
  await page.locator('[data-scenario-action="scene-page-first"]').click();
  await page.locator('[data-scenario-action="repair"]').click(); await waitState('mode', 'repair');
  await page.locator('[data-scenario-action="scene-page-next"]').click();
  await page.waitForFunction(() => JSON.parse(document.querySelector('[data-testid="agent-targeting-evidence"]').textContent).state.scenePage?.status === 'cursor-expired');
  pagination.expired = (await readEvidence()).scenePage;
  assert.deepEqual(pagination.expired.records, []); assert.equal(pagination.expired.nextCursor, null);
  pagination.status = 'pass'; await checkpoint(report, `${stage}:complete`);
  assert.deepEqual(report.errors, []);
  assert.equal(report.droppedErrors, 0);
  await readEvidence();
  assertIdentity(report.expectedIdentity, await sourceIdentity(repository));
  report.status = 'pass';
} catch (error) {
  failed = true;
  report.browserFailure = browserFailure?.snapshot() ?? null;
  recordReplayFailure(report, error, stage);
} finally {
  try { await checkpoint(report, 'before-cleanup'); }
  catch (error) { report.checkpointFailure = describeReplayError(error).message.slice(0, 1000); report.status = 'fail'; process.exitCode = 1; }
  browserFailure?.beginCleanup();
  try { await browser?.close(); }
  catch (error) { failed = true; report.status = 'fail'; report.cleanupFailure = describeReplayError(error).message.slice(0, 1000); }
  report.browserFailure = browserFailure?.snapshot() ?? null;
  browserFailure?.dispose();
  await finalizeReplayToolIdentity(report, repository);
  if (!finalizeReplayOutcome(report, ['seed', 'repair', 'intentional-block', 'outside-layer', 'capture-drag', 'dom-overlay', 'keyboard-focus', 'scene-pagination'])) failed = true;
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${report.status}: ${resolve(output, 'report.json')}\n`);
  if (failed) process.exitCode = 1;
}

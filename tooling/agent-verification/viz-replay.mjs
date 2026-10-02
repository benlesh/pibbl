import { reserveEvidenceDirectory } from './evidence-directory.mjs';
import { assertNear } from './numeric-assertion.mjs';
import { describeReplayError, recordReplayFailure } from './failure-evidence.mjs';
import { capturePageEnvironment, createReplayManifest, captureReplayToolIdentity, finalizeReplayToolIdentity } from './run-manifest.mjs';
import { createCheckpointWriter } from './checkpoint.mjs';
import { finalizeReplayOutcome } from './replay-outcome.mjs';
import { observeBrowserFailure } from './browser-failure.mjs';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { sourceIdentity, assertIdentity } from './identity.mjs';
const repository = resolve(import.meta.dirname, '../..');
const density = Number(process.env.CRC_VERIFY_DENSITY ?? 1);
assert.ok(density === 1 || density === 2, 'CRC_VERIFY_DENSITY must be 1 or 2');
const url = process.argv[2];
if (!url) throw new Error('Provide the source Studio URL ending in #/testing/viz-hover-lab');
const output = process.argv[3] ? resolve(process.argv[3]) : resolve(repository, 'packages/core/test/out/agent-viz', new Date().toISOString().replaceAll(':', '-'));
await reserveEvidenceDirectory(output);
const report = { schema: 'crc-viz-replay/1', status: 'incomplete', url, node: process.version, density,
  provenance: 'Loaded fixture fingerprint covers core/viz source, fixture/example, identity tooling, dev config and lockfile; not full installed dependency or asset attestation.', steps: [], errors: [], droppedErrors: 0 };
const checkpoint = createCheckpointWriter(output);
report.checkpointRunId = checkpoint.runId;
report.run = createReplayManifest({ runId: checkpoint.runId, repository, kind: 'viz', url, density });
let browser;
let browserFailure;
try {
  await checkpoint(report, 'setup');
  report.expectedIdentity = await sourceIdentity(repository, 'viz');
  report.run.toolIdentity = await captureReplayToolIdentity(repository, 'viz', report.expectedIdentity.revision);
  browser = process.env.CRC_VERIFY_BROWSER_ENDPOINT
    ? await chromium.connect(process.env.CRC_VERIFY_BROWSER_ENDPOINT, { timeout: 15000 })
    : await chromium.launch({ timeout: 15000 }); report.browser = browser.version();
  const page = await browser.newPage(report.run.environment.browserContext);
  browserFailure = observeBrowserFailure(browser, page);
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => { if (report.errors.length < 16) report.errors.push(error.message.slice(0, 1000)); else report.droppedErrors++; });
  await checkpoint(report, 'navigation');
  await page.goto(url);
  report.run.environment.observedPage = await capturePageEnvironment(page);
  const evidence = page.getByTestId('agent-viz-evidence');
  await evidence.waitFor({ state: 'attached' });
  const readEvidence = async () => {
    const text = await evidence.textContent(); assert.ok(text && text.length < 65536);
    const parsed = JSON.parse(text); assert.equal(parsed.schema, 'crc-viz-fixture/1');
    report.servedIdentity = parsed.identity ?? null;
    assertIdentity(report.expectedIdentity, parsed.identity);
    return parsed.state;
  };
  await page.waitForFunction(() => !!document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent);
  await readEvidence();
  const canvas = page.getByTestId('scenario-canvas');
  await page.locator('[data-scenario-action="interpolated-x"]').click();
  const host = await canvas.boundingBox(); assert.ok(host);
  const size = await canvas.evaluate(canvas => ({ width: canvas.clientWidth, height: canvas.clientHeight }));
  const top = size.width < 650 ? 235 : 175;
  const width = Math.max(1, size.width - 83), height = Math.max(100, size.height - top - 70);
  report.oracle = { plot: { x: 55, y: top, width, height }, x: 5, initialY: 20, updatedY: 30 };
  for (const generation of [0, 1, 2]) {
    const step = { actionId: ['interpolation-initial', 'interpolation-updated', 'interpolation-missing'][generation], generation, transport: 'native-playwright-pointer', status: 'incomplete' };
    report.steps.push(step);
    await checkpoint(report, `generation-${generation}`);
    if (generation) await page.locator(`[data-scenario-action="${generation === 1 ? 'update-data' : 'missing-data'}"]`).click();
    await page.mouse.move(host.x + 55 + width / 2, host.y + top + height / 2);
    await page.waitForFunction(generation => {
      const element = document.querySelector('[data-testid="agent-viz-evidence"]');
      if (!element?.textContent) return false;
      const state = JSON.parse(element.textContent).state;
      return state.generation === generation && state.mode === 'interpolated-x' && state.inspection !== null && Math.abs(state.inspection - 5) < 1e-8;
    }, generation);
    const state = await readEvidence();
    assert.equal(Math.round(state.viewport.width), size.width);
    assert.equal(Math.round(state.viewport.height), size.height);
    assert.deepEqual(state.plot, report.oracle.plot);
    assert.deepEqual(state.results.map(result => result.series), generation === 2 ? ['adjusted'] : ['monthly', 'adjusted']);
    for (const result of state.results) {
      const y = result.series === 'monthly' && generation ? 30 : 20;
      assert.equal(result.kind, 'interpolated');
      assertNear(result.x, 5, 1e-8, { quantity: 'interpolated x', units: 'data-x' }); assertNear(result.y, y, 1e-8, { quantity: 'interpolated y', units: 'data-y' });
      assertNear(result.anchor.x, width / 2, 1e-8, { quantity: 'interpolated anchor x', units: 'plot-pixels' });
      assertNear(result.anchor.y, height * (1 - y / 40), 1e-8, { quantity: 'interpolated anchor y', units: 'plot-pixels' });
    }
    step.state = state;
    step.status = 'pass';
    await checkpoint(report, `generation-${generation}:complete`);
  }
  for (const [offset, action, expectedY, id, index, policy] of [
    [0, 'duplicate-first', 10, 'low', 1, 'first'],
    [1, 'duplicate-last', 30, 'high', 2, 'last'],
    [2, 'duplicate-reordered', 30, 'high', 1, 'first'],
  ]) {
    const generation = offset + 3;
    const step = { actionId: action, generation, action, status: 'incomplete', transport: 'native-playwright-pointer', observations: [] };
    report.steps.push(step);
    await checkpoint(report, action);
    await page.locator(`[data-scenario-action="${action}"]`).click();
    for (const x of [5, 2.5]) {
      await page.mouse.move(host.x + 55 + width * x / 10, host.y + top + height / 2);
      await page.waitForFunction(({ generation, x }) => {
        const text = document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent;
        if (!text) return false;
        const state = JSON.parse(text).state;
        return state.generation === generation && state.inspection !== null && Math.abs(state.inspection - x) < 1e-8;
      }, { generation, x });
      const state = await readEvidence();
      step.observations.push(state);
      assert.equal(state.duplicateX, policy);
      assert.deepEqual(state.results.map(result => result.series), ['monthly', 'adjusted']);
      const first = state.results[0];
      const y = x === 5 ? expectedY : (10 + expectedY) / 2;
      assert.equal(first.kind, x === 5 ? 'exact' : 'interpolated');
      assertNear(first.x, x, 1e-8, { quantity: 'duplicate-policy x', units: 'data-x' });
      assertNear(first.y, y, 1e-8, { quantity: 'duplicate-policy y', units: 'data-y' });
      assertNear(first.anchor.x, width * x / 10, 1e-8, { quantity: 'duplicate-policy anchor x', units: 'plot-pixels' });
      assertNear(first.anchor.y, height * (1 - y / 40), 1e-8, { quantity: 'duplicate-policy anchor y', units: 'plot-pixels' });
      assert.deepEqual(first.provenance, x === 5
        ? { kind: 'recorded', index, id }
        : { kind: 'interpolated', beforeIndex: 0, afterIndex: index, beforeId: 'start', afterId: id, fraction: 0.5 });
      assertNear(state.results[1].y, (30 - (x - 2) * 20 / 6), 1e-8, { quantity: 'secondary series interpolation', units: 'data-y' });
    }
    step.status = 'pass';
    await checkpoint(report, `${action}:complete`);
  }
  const nearest = { actionId: 'nearest-unsorted', generation: 6, action: 'nearest-unsorted', status: 'incomplete', observations: [] };
  report.steps.push(nearest);
  await checkpoint(report, 'nearest-unsorted');
  await page.locator('[data-scenario-action="nearest-unsorted"]').click();
  await canvas.scrollIntoViewIfNeeded();
  const nearestHost = await canvas.boundingBox(); assert.ok(nearestHost);
  for (const [x, selectedX, id, index] of [[5, 5, 'high', 1], [2.5, 5, 'high', 1], [7.5, 10, 'end', 0]]) {
    for (const yFraction of [0.1, 0.9]) {
      await page.mouse.move(nearestHost.x + 55 + width * x / 10, nearestHost.y + top + height * yFraction);
      await page.waitForFunction(x => {
        const text = document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent;
        if (!text) return false;
        const state = JSON.parse(text).state;
        return state.generation === 6 && state.mode === 'nearest-per-line' && state.inspection !== null && Math.abs(state.inspection - x) < 1e-8;
      }, x);
      const state = await readEvidence(); nearest.observations.push({ pointerYFraction: yFraction, state });
      assert.equal(state.results.length, 2);
      const selected = state.results[0];
      assert.equal(selected.series, 'monthly'); assert.equal(selected.kind, 'recorded');
      assert.equal(selected.x, selectedX); assert.equal(selected.y, 30);
      assert.deepEqual(selected.provenance, { kind: 'recorded', index, id });
      assertNear(selected.anchor.x, width * selectedX / 10, 1e-8, { quantity: 'nearest anchor x', units: 'plot-pixels' });
      assertNear(selected.anchor.y, height / 4, 1e-8, { quantity: 'nearest anchor y', units: 'plot-pixels' });
    }
  }
  nearest.status = 'pass'; await checkpoint(report, 'nearest-unsorted:complete');
  const empty = { actionId: 'empty-data', generation: 7, action: 'empty-data', status: 'incomplete' };
  report.steps.push(empty); await checkpoint(report, 'empty-data');
  await page.locator('[data-scenario-action="empty-data"]').click();
  await canvas.scrollIntoViewIfNeeded();
  const emptyHost = await canvas.boundingBox(); assert.ok(emptyHost);
  await page.mouse.move(emptyHost.x + 55 + width / 2, emptyHost.y + top + height / 2);
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent;
    if (!text) return false;
    const state = JSON.parse(text).state;
    return state.generation === 7 && state.inspection !== null && Math.abs(state.inspection - 5) < 1e-8;
  });
  empty.state = await readEvidence();
  assert.equal(empty.state.results.length, 1);
  assert.deepEqual(empty.state.results[0].provenance, { kind: 'recorded', index: 0, id: null });
  assert.equal(empty.state.results[0].series, 'adjusted');
  assert.equal(empty.state.results[0].x, 2); assert.equal(empty.state.results[0].y, 30);
  await page.mouse.move(emptyHost.x + 10, emptyHost.y + 10);
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent;
    return !!text && JSON.parse(text).state.inspection === null;
  });
  empty.afterLeave = await readEvidence(); assert.deepEqual(empty.afterLeave.results, []);
  empty.status = 'pass'; await checkpoint(report, 'empty-data:complete');
  const point = { actionId: 'closest-point-native', generation: 8, action: 'closest-point-native', status: 'incomplete', observations: [] };
  report.steps.push(point); await checkpoint(report, point.action);
  await page.locator('[data-scenario-action="reset"]').click();
  await page.locator('[data-scenario-action="closest-point"]').click();
  await canvas.scrollIntoViewIfNeeded();
  const pointHost = await canvas.boundingBox(); assert.ok(pointHost);
  for (const distance of [30, 40, 40.25]) {
    await page.mouse.move(pointHost.x + 55 + distance, pointHost.y + top + height * 0.75);
    await page.waitForFunction(({ distance, y }) => {
      const text = document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent;
      if (!text) return false;
      const state = JSON.parse(text).state;
      return state.generation === 8 && state.mode === 'closest-point' && state.pointer && Math.abs(state.pointer.x - distance) < 0.0001 && Math.abs(state.pointer.y - y) < 0.0001;
    }, { distance, y: height * 0.75 });
    const state = await readEvidence(); point.observations.push(state);
    assert.equal(state.results.length, distance <= 40 ? 1 : 0);
    if (distance <= 40) {
      const hit = state.results[0];
      assert.equal(hit.series, 'monthly'); assert.equal(hit.kind, 'recorded');
      assert.equal(hit.x, 0); assert.equal(hit.y, 10);
      assert.deepEqual(hit.anchor, { x: 0, y: height * 0.75 });
      assert.deepEqual(hit.provenance, { kind: 'recorded', index: 0, id: null });
      assert.equal(hit.distance.space, 'plot-pixels');
      assertNear(hit.distance.value, distance, 0.0001, { quantity: 'closest-point distance', units: 'plot-pixels' });
    }
  }
  point.status = 'pass'; await checkpoint(report, `${point.action}:complete`);
  for (const [action, generation, values, hoverY] of [
    ['weighted-data-bug', 9, [20, 20], 20],
    ['weighted-data', 10, [10, 30], 15],
  ]) {
    const step = { actionId: action, action, generation, status: 'incomplete' };
    report.steps.push(step); await checkpoint(report, action);
    await page.locator(`[data-scenario-action="${action}"]`).click();
    await canvas.scrollIntoViewIfNeeded();
    const host = await canvas.boundingBox(); assert.ok(host);
    await page.mouse.move(host.x + 55 + width / 4, host.y + top + height / 2);
    await page.waitForFunction(generation => {
      const text = document.querySelector('[data-testid="agent-viz-evidence"]')?.textContent;
      if (!text) return false;
      const state = JSON.parse(text).state;
      return state.generation === generation && state.inspection !== null && Math.abs(state.inspection - 2.5) < 1e-8;
    }, generation);
    const state = await readEvidence(); step.state = state;
    assert.deepEqual(state.plot, report.oracle.plot);
    assert.deepEqual(state.pipeline, {
      generation, operation: 'weighted-mean', units: 'score', rounding: 'none',
      inputCount: 5, includedCount: 4, excludedCount: 1, outputCount: 2,
      groups: [
        { x: 0, count: 2, weightedSum: 40, weightSum: 4, value: values[0] },
        { x: 10, count: 2, weightedSum: 120, weightSum: 4, value: values[1] },
      ],
    });
    const hit = state.results.find(result => result.series === 'monthly'); assert.ok(hit);
    assertNear(hit.x, 2.5, 1e-8, { quantity: 'aggregation inspection x', units: 'data-x' });
    assertNear(hit.y, hoverY, 1e-8, { quantity: 'aggregate interpolation', units: 'score' });
    assertNear(hit.anchor.x, width / 4, 0.0001, { quantity: 'aggregate anchor x', units: 'plot-pixels' });
    assertNear(hit.anchor.y, height * (1 - hoverY / 40), 0.0001, { quantity: 'aggregate anchor y', units: 'plot-pixels' });
    step.analysis = {
      intendedGroupValues: [10, 30], observedGroupValues: values,
      intendedHoverValue: 15, observedHoverValue: hit.y,
      result: action === 'weighted-data-bug' ? 'intentional-arithmetic-defect-detected' : 'weighted-calculation-restored',
      scope: 'Independent fixture arithmetic and semantic geometry; not a general causal inference engine.',
    };
    step.status = 'pass'; await checkpoint(report, `${action}:complete`);
  }
  assert.deepEqual(report.errors, []);
  await readEvidence();
  assertIdentity(report.expectedIdentity, await sourceIdentity(repository, 'viz'));
  report.status = 'pass';
} catch (error) { report.browserFailure = browserFailure?.snapshot() ?? null; recordReplayFailure(report, error); process.exitCode = 1; }
finally {
  try { await checkpoint(report, 'before-cleanup'); }
  catch (error) { report.checkpointFailure = describeReplayError(error).message.slice(0, 1000); report.status = 'fail'; process.exitCode = 1; }
  browserFailure?.beginCleanup();
  try { await browser?.close(); } catch (error) { report.browserFailure = browserFailure?.snapshot() ?? null; report.status = 'fail'; report.cleanupFailure = describeReplayError(error).message; process.exitCode = 1; }
  report.browserFailure = browserFailure?.snapshot() ?? null;
  browserFailure?.dispose();
  await finalizeReplayToolIdentity(report, repository);
  if (!finalizeReplayOutcome(report, ['interpolation-initial', 'interpolation-updated', 'interpolation-missing', 'duplicate-first', 'duplicate-last', 'duplicate-reordered', 'nearest-unsorted', 'empty-data', 'closest-point-native', 'weighted-data-bug', 'weighted-data'])) process.exitCode = 1;
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(`${report.status}: ${resolve(output, 'report.json')}\n`);
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requiredReplayChecks } from './required-checks.mjs';

test('declares independent immutable check manifests for both replay recipes', () => {
  const targeting = requiredReplayChecks('targeting');
  const viz = requiredReplayChecks('viz');
  assert.equal(targeting.length, 21); assert.equal(viz.length, 127);
  for (const manifest of [targeting, viz]) {
    assert.equal(new Set(manifest.map(item => item.checkId)).size, manifest.length);
    assert.ok(Object.isFrozen(manifest)); assert.ok(manifest.every(Object.isFrozen));
  }
  assert.ok(targeting.some(item => item.checkId === 'repair.selected-entity' && item.actionId === 'repair'));
  for (const subject of ['policy', 'counts', 'categories', 'generation', 'zero', 'interpolated', ...[2.5, 3, 4, 5, 6, 7, 7.5].map(x => `gap-${x}`)]) {
    assert.ok(viz.some(item => item.checkId === `zero-missing-invalid.${subject}` && item.actionId === 'zero-missing-invalid'));
  }
  assert.ok(viz.some(item => item.checkId === 'weighted-data.aggregation-pipeline'));
  assert.ok(viz.some(item => item.checkId === 'async-retry-success.request-policy')); 
  assert.ok(viz.some(item => item.checkId === 'interpolation-missing.adjusted.interpolated-y'));
  assert.ok(!viz.some(item => item.checkId.startsWith('interpolation-missing.monthly')));
  assert.throws(() => requiredReplayChecks('unknown'), /kind/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalizeReplayOutcome } from './replay-outcome.mjs';

test('errors arriving after provisional success cannot produce a passing report', async () => {
  const report = { status: 'pass', errors: [], droppedErrors: 0 };
  // Represents an event delivered during the final awaited read or cleanup.
  await Promise.resolve().then(() => report.errors.push('late page error'));
  assert.equal(finalizeReplayOutcome(report), false);
  assert.equal(report.status, 'fail');
  assert.equal(report.observationFailure.category, 'browser-observation-error');
  assert.deepEqual(report.errors, ['late page error']);
});

test('overflow and transport failures also invalidate provisional success', () => {
  for (const extra of [
    { droppedErrors: 1 },
    { browserFailure: { category: 'page-crash' } },
    { browserFailure: { category: 'browser-disconnected' } },
  ]) {
    const report = { status: 'pass', errors: [], droppedErrors: 0, ...extra };
    assert.equal(finalizeReplayOutcome(report), false);
    assert.equal(report.status, 'fail');
  }
});

test('clean shutdown passes but existing failure or blocked evidence is preserved', () => {
  const clean = { status: 'pass', errors: [], browserFailure: { category: null } };
  assert.equal(finalizeReplayOutcome(clean), true);
  for (const status of ['fail', 'blocked', 'incomplete']) {
    const failure = { category: 'original', message: 'keep me' };
    const report = { status, errors: [], failure };
    assert.equal(finalizeReplayOutcome(report), false);
    assert.equal(report.status, status);
    assert.equal(report.failure, failure);
  }
});


test('a pass label cannot hide missing or unfinished required actions', () => {
  for (const steps of [[], [{ status: 'incomplete' }], [{ status: 'fail' }]]) {
    const report = { status: 'pass', errors: [], steps };
    assert.equal(finalizeReplayOutcome(report, 1), false);
    assert.equal(report.status, 'fail');
    assert.equal(report.completionFailure.category, 'incomplete-required-actions');
  }
  const complete = { status: 'pass', errors: [], steps: [{ status: 'pass' }] };
  assert.equal(finalizeReplayOutcome(complete, 1), true);
});


test('required action identities reject substitutions, duplicates and reordered evidence', () => {
  const required = ['mount', 'select', 'dispose'];
  for (const ids of [required, ['mount', 'mount', 'dispose'], ['mount', 'other', 'dispose'], ['select', 'mount', 'dispose'], ['mount', undefined, 'dispose']]) {
    const report = { status: 'pass', errors: [], steps: ids.map(actionId => ({ actionId, status: 'pass' })) };
    assert.equal(finalizeReplayOutcome(report, required), ids === required);
    assert.deepEqual(report.requiredActions, required);
    if (ids !== required) assert.equal(report.completionFailure.category, 'incomplete-required-actions');
  }
});

test('invalid required action manifests cannot silently certify a run', () => {
  for (const manifest of [[], ['same', 'same'], [''], [null]]) {
    assert.throws(() => finalizeReplayOutcome({ status: 'pass', errors: [], steps: [] }, manifest), /action/i);
  }
});

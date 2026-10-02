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

test('explicit check outcomes retain non-pass reasons and cannot certify missing required evidence', () => {
  for (const [status, expected] of [['pass', 'pass'], ['fail', 'fail'], ['blocked', 'blocked'], ['inconclusive', 'inconclusive'], ['skipped', 'inconclusive'], ['not-applicable', 'inconclusive']]) {
    const report = { status: 'pass', errors: [], steps: [{ actionId: 'inspect', status: 'pass' }],
      checks: [{ checkId: 'geometry', status, required: true, reason: status === 'pass' ? null : 'Explicit fixture condition.' }] };
    assert.equal(finalizeReplayOutcome(report, ['inspect']), status === 'pass');
    assert.equal(report.status, expected);
    if (status !== 'pass') assert.equal(report.checkFailure.checkId, 'geometry');
  }
});

test('optional skipped or inapplicable checks remain visible without becoming passed checks', () => {
  const checks = ['blocked', 'inconclusive', 'skipped', 'not-applicable'].map(status => ({ checkId: status, status, required: false, reason: 'Declared optional applicability or coverage limit.' }));
  const report = { status: 'pass', errors: [], checks };
  assert.equal(finalizeReplayOutcome(report), true);
  assert.deepEqual(report.checks, checks);
  report.checks.push({ checkId: 'actual-failure', status: 'fail', required: false, reason: 'An executed assertion failed.' });
  assert.equal(finalizeReplayOutcome(report), false);
  assert.equal(report.status, 'fail');
});

test('rejects unknown, ambiguous and reasonless check records instead of treating them as success', () => {
  const valid = { checkId: 'one', status: 'pass', required: true, reason: null };
  for (const checks of [[{ ...valid, status: 'probably-pass' }], [{ ...valid, status: 'skipped' }], [{ ...valid, required: undefined }], [valid, valid], [{}], 'pass']) {
    const report = { status: 'pass', errors: [], checks };
    assert.equal(finalizeReplayOutcome(report), false);
    assert.equal(report.status, 'fail');
    assert.equal(report.checkFailure.category, 'invalid-check-outcomes');
  }
});

test('a declared check manifest prevents passing a completed subset or relabeling required checks', () => {
  const manifest = [{ checkId: 'one', actionId: 'inspect' }, { checkId: 'two', actionId: 'inspect' }];
  const checks = manifest.map(item => ({ ...item, status: 'pass', required: true, reason: null }));
  for (const observed of [checks.slice(0, 1), [], [{ ...checks[0], required: false }, checks[1]], [{ ...checks[0], actionId: 'other' }, checks[1]], [...checks, { ...checks[0], checkId: 'extra' }]]) {
    const report = { status: 'pass', errors: [], requiredChecks: manifest, checks: observed };
    assert.equal(finalizeReplayOutcome(report), false);
    assert.equal(report.checkCompletionFailure.category, 'incomplete-required-checks');
  }
  const complete = { status: 'pass', errors: [], requiredChecks: manifest, checks };
  assert.equal(finalizeReplayOutcome(complete), true);
  const absent = { status: 'pass', errors: [], requiredChecks: manifest };
  assert.equal(finalizeReplayOutcome(absent), false);
  for (const requiredChecks of [[], [manifest[0], manifest[0]], [{ checkId: 'one' }], 'one']) {
    const report = { status: 'pass', errors: [], requiredChecks, checks };
    assert.equal(finalizeReplayOutcome(report), false);
    assert.equal(report.checkCompletionFailure.category, 'invalid-required-check-manifest');
  }
});

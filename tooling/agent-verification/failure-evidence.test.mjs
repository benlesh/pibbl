import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeReplayError } from './failure-evidence.mjs';

test('retains structured expected/actual values from native assertion errors', () => {
  let failure;
  try { assert.deepEqual({ selected: 'wrong', point: [4, 5] }, { selected: 'item-a', point: [4, 6] }); }
  catch (error) { failure = error; }
  const evidence = describeReplayError(failure);
  assert.equal(evidence.code, 'ERR_ASSERTION');
  assert.equal(evidence.assertion.operator, 'deepStrictEqual');
  assert.deepEqual(evidence.assertion.actual.entries[0], { key: 'selected', value: 'wrong' });
  assert.deepEqual(evidence.assertion.expected.entries[0], { key: 'selected', value: 'item-a' });
  assert.equal(evidence.detail.omissions.length, 0);
  assert.doesNotThrow(() => JSON.stringify(evidence));
});

test('bounds details, handles cycles and never evaluates getters or toJSON', () => {
  let invoked = 0;
  const actual = { text: 'x'.repeat(20000), values: Array(100).fill(1), toJSON() { invoked++; throw new Error('must not run'); } };
  actual.self = actual;
  Object.defineProperty(actual, 'getter', { enumerable: true, get() { invoked++; return 'secret'; } });
  const error = new Error('m'.repeat(10000));
  Object.assign(error, { code: 'ERR_ASSERTION', operator: 'deepStrictEqual', actual, expected: undefined });
  const evidence = describeReplayError(error);
  assert.equal(invoked, 0);
  assert.ok(evidence.detail.omissions.includes('string-limit'));
  assert.ok(evidence.detail.omissions.includes('entry-limit'));
  assert.ok(evidence.detail.omissions.includes('cycle'));
  assert.ok(evidence.detail.omissions.includes('accessor'));
  assert.ok(JSON.stringify(evidence).length < 16000);
  assert.equal(invoked, 0);
});

test('ordinary errors do not invent expected values or invoke custom string conversion', () => {
  const error = { toString() { throw new Error('must not run'); } };
  assert.equal(describeReplayError(error).assertion, null);
  assert.equal(describeReplayError('plain failure').message, 'plain failure');
});


test('deep and wide values stay bounded without consuming the failure summary', () => {
  const deep = { a: { a: { a: { a: { a: 1 } } } } };
  const wide = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => 'x'.repeat(2000)));
  const error = Object.assign(new Error('Keep this first failure summary'), { code: 'ERR_ASSERTION', operator: 'deepStrictEqual', actual: wide, expected: deep });
  const evidence = describeReplayError(error);
  assert.equal(evidence.message, 'Keep this first failure summary');
  assert.ok(evidence.detail.omissions.includes('depth-limit'));
  assert.ok(evidence.detail.omissions.includes('node-limit'));
  assert.ok(evidence.detail.omissions.includes('string-limit'));
  assert.ok(JSON.stringify(evidence).length < 16000);
});

test('preserves layout diagnostic fields without invoking supplied-value accessors', () => {
  let reads = 0;
  const suppliedValue = {};
  Object.defineProperty(suppliedValue, 'secret', { enumerable: true, get() { reads++; throw new Error('must not read'); } });
  const error = Object.assign(new Error('invalid width'), { name: 'LayoutDiagnostic', component: 'Absolute', property: 'width', suppliedValue, algorithm: 'absolute', constraints: { minWidth: 0, maxWidth: 400, minHeight: 0, maxHeight: 200 } });
  const evidence = describeReplayError(error);
  assert.equal(evidence.layoutDiagnostic.component, 'Absolute');
  assert.equal(evidence.layoutDiagnostic.property, 'width');
  assert.equal(evidence.layoutDiagnostic.algorithm, 'absolute');
  assert.equal(evidence.layoutDiagnostic.constraints.type, 'object');
  assert.equal(reads, 0);
  assert.ok(evidence.detail.omissions.includes('accessor'));
  assert.equal(describeReplayError(new Error('ordinary')).layoutDiagnostic, null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNear } from './numeric-assertion.mjs';
import { describeReplayError } from './failure-evidence.mjs';

const meaning = { quantity: 'tooltip anchor x', units: 'plot-pixels' };
test('numeric assertion preserves the original exclusive tolerance boundary', () => {
  assertNear(5.0625, 5, 0.125, meaning);
  for (const actual of [5.125, 4.875, NaN, Infinity]) {
    assert.throws(() => assertNear(actual, 5, 0.125, meaning), { code: 'ERR_ASSERTION' });
  }
});

test('failed numeric comparisons serialize operands, tolerance, difference and units', () => {
  let failure;
  try { assertNear(12, 10, 0.25, meaning); } catch (error) { failure = error; }
  const evidence = describeReplayError(failure);
  assert.equal(evidence.assertion.actual, 12);
  assert.equal(evidence.assertion.expected, 10);
  assert.equal(evidence.assertion.operator, 'absolute-error < tolerance');
  assert.deepEqual(Object.fromEntries(evidence.assertion.comparison.entries.map(({ key, value }) => [key, value])), {
    quantity: 'tooltip anchor x', units: 'plot-pixels', tolerance: 0.25, difference: 2, boundary: 'exclusive',
  });
});

test('invalid numeric oracle configuration rejects rather than accepting any value', () => {
  for (const tolerance of [0, -1, NaN, Infinity]) assert.throws(() => assertNear(5, 5, tolerance, meaning), RangeError);
  assert.throws(() => assertNear(5, NaN, 0.1, meaning), RangeError);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordAssertion } from './recorded-check.mjs';

const report = () => ({ steps: [{ actionId: 'select', status: 'incomplete' }], checks: [] });
const spec = { checkId: 'select.entity', actionId: 'select' };
test('records completed assertions and retains failure operands with exact action identity', async () => {
  const result = report();
  assert.equal(await recordAssertion(result, spec, () => 42), 42);
  assert.deepEqual(result.checks[0], { ...spec, status: 'pass', required: true, reason: null });
  const original = new assert.AssertionError({ actual: 'b', expected: 'a', operator: 'strictEqual' });
  await assert.rejects(recordAssertion(result, { ...spec, checkId: 'select.wrong' }, () => { throw original; }), error => error === original);
  assert.equal(result.checks[1].status, 'fail');
  assert.deepEqual(result.checks[1].failure.assertion, { operator: 'strictEqual', expected: 'a', actual: 'b' });
  assert.deepEqual(result.firstFailedCheck, { checkId: 'select.wrong', actionId: 'select' });
  await assert.rejects(recordAssertion(result, { ...spec, checkId: 'select.later' }, () => { throw new Error('later'); }));
  assert.equal(result.firstFailedCheck.checkId, 'select.wrong');
});

test('pending async checks remain non-passing until the assertion settles', async () => {
  const result = report(); let finish;
  const task = recordAssertion(result, spec, () => new Promise(resolve => { finish = resolve; }));
  const pending = result.checks[0];
  assert.equal(pending.status, 'blocked'); assert.ok(pending.reason);
  finish(); await task;
  assert.equal(result.checks[0].status, 'pass'); assert.equal(pending.status, 'blocked');
});

test('invalid identities and exhausted capacity cannot execute assertions', async () => {
  for (const invalid of [{ ...spec, actionId: 'unknown' }, { ...spec, checkId: '' }, { ...spec, checkId: 'x'.repeat(129) }]) {
    let executed = false;
    await assert.rejects(recordAssertion(report(), invalid, () => { executed = true; }));
    assert.equal(executed, false);
  }
  const result = report(); await recordAssertion(result, spec, () => {});
  await assert.rejects(recordAssertion(result, spec, () => assert.fail('must not execute')), /duplicate/i);
  result.checks = Array.from({ length: 256 }, (_, index) => ({ checkId: String(index) }));
  await assert.rejects(recordAssertion(result, spec, () => assert.fail('must not execute')), /capacity/i);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequirementLedger } from './requirements.mjs';

const inventory = '- **ID-01:** First requirement.\n  More detail.\n- **ID-02:** Second requirement.\n';
const row = id => ({ id, status: 'unassessed', evidence: [], remaining: 'Audit the exact requirement.' });
test('requires every inventory ID exactly once', () => {
  assert.doesNotThrow(() => validateRequirementLedger(inventory, { requirements: [row('ID-01'), row('ID-02')] }));
  for (const requirements of [[row('ID-01')], [row('ID-01'), row('ID-01')], [row('ID-01'), row('ID-02'), row('ID-03')]]) {
    assert.throws(() => validateRequirementLedger(inventory, { requirements }));
  }
});
test('rejects unsupported completion claims and missing remaining work', () => {
  assert.throws(() => validateRequirementLedger(inventory, { requirements: [{ ...row('ID-01'), status: 'verified' }, row('ID-02')] }));
  assert.throws(() => validateRequirementLedger(inventory, { requirements: [{ ...row('ID-01'), remaining: '' }, row('ID-02')] }));
  assert.throws(() => validateRequirementLedger(inventory, { requirements: [{ ...row('ID-01'), status: 'partial' }, row('ID-02')] }));
});
test('distinguishes an audited gap from an unassessed requirement', () => {
  const requirements = [{ ...row('ID-01'), status: 'gap', evidence: [{ path: 'runtime.ts', supports: 'Audited boundary lacks the requested observation.' }] }, row('ID-02')];
  assert.equal(validateRequirementLedger(inventory, { requirements }).gap, 1);
  assert.throws(() => validateRequirementLedger(inventory, { requirements: [{ ...requirements[0], evidence: [] }, row('ID-02')] }));
});

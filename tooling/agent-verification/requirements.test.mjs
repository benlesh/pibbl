import { test } from 'node:test';
import assert from 'node:assert/strict';
<<<<<<< HEAD
import { validateRequirementLedger, verifyClosureFiles } from './requirements.mjs';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
=======
import { validateRequirementLedger } from './requirements.mjs';
>>>>>>> origin/main

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
<<<<<<< HEAD

test('accepts a fully specified reviewed closure but rejects incomplete claims', () => {
  const complete = { ...row('ID-01'), status: 'complete', remaining: '',
    evidence: [{ path: 'runtime.ts', supports: 'Implements the complete first requirement.' }],
    closure: { schema: 'crc-requirement-closure/1', inventorySha256: 'a'.repeat(64),
      requirementText: '- **ID-01:** First requirement. More detail.',
      reviewedAt: '2026-10-01', review: 'Every clause reviewed against the current implementation and independent acceptance evidence.',
      acceptance: [{ criterion: 'First requirement including more detail.', evidencePaths: ['runtime.ts'], checkIds: ['acceptance'] }],
      checks: [{ id: 'acceptance', command: 'node --test test.mjs', environment: 'Node 24', result: 'pass', artifact: 'results.json' }],
      files: [{ path: 'runtime.ts', sha256: 'b'.repeat(64) }, { path: 'results.json', sha256: 'c'.repeat(64) }],
    } };
  const ledger = { inventorySha256: 'a'.repeat(64), requirements: [complete, row('ID-02')] };
  assert.equal(validateRequirementLedger(inventory, ledger).certifiedComplete, 1);
  for (const change of [
    value => { value.requirements[0].closure = undefined; },
    value => { value.requirements[0].remaining = 'Still missing one clause.'; },
    value => { value.requirements[0].closure.requirementText = 'Only the easy part.'; },
    value => { value.requirements[0].closure.inventorySha256 = 'd'.repeat(64); },
    value => { value.requirements[0].closure.acceptance = []; },
    value => { value.requirements[0].closure.checks[0].result = 'partial'; },
    value => { value.requirements[0].closure.acceptance[0].checkIds = ['unknown']; },
    value => { value.requirements[0].closure.acceptance[0].evidencePaths = ['other.ts']; },
    value => { value.requirements[0].closure.files.pop(); },
    value => { value.requirements[0].closure.files[0].sha256 = 'not-a-hash'; },
    value => { value.requirements[0].closure.files[0].path = '../outside'; },
  ]) {
    const invalid = structuredClone(ledger); change(invalid);
    assert.throws(() => validateRequirementLedger(inventory, invalid));
  }
});


test('closure evidence expires after changes or deletion and cannot escape through symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crc-closure-'));
  const external = await mkdtemp(join(tmpdir(), 'crc-closure-external-'));
  const sha256 = createHash('sha256').update('recorded evidence').digest('hex');
  const ledger = { requirements: [{ id: 'ID-01', status: 'complete', closure: { files: [{ path: 'evidence.json', sha256 }] } }] };
  try {
    await writeFile(join(root, 'evidence.json'), 'recorded evidence');
    assert.deepEqual(await verifyClosureFiles(root, ledger), { verifiedFiles: 1, scope: 'recorded-file-integrity-not-semantic-proof' });
    await writeFile(join(root, 'evidence.json'), 'new evidence');
    await assert.rejects(verifyClosureFiles(root, ledger), /evidence changed/);
    await rm(join(root, 'evidence.json'));
    await assert.rejects(verifyClosureFiles(root, ledger), { code: 'ENOENT' });
    await writeFile(join(external, 'evidence.json'), 'recorded evidence');
    await symlink(join(external, 'evidence.json'), join(root, 'evidence.json'));
    await assert.rejects(verifyClosureFiles(root, ledger), /escapes repository/);
  } finally { await rm(root, { recursive: true, force: true }); await rm(external, { recursive: true, force: true }); }
});
=======
>>>>>>> origin/main

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { discoverRequirement } from './discover.mjs';
const root = resolve(import.meta.dirname, '../..');
const ledger = JSON.parse(await readFile(resolve(root, 'docs/strategy/agent-verification-ledger.json'), 'utf8'));

test('finds a requirement-linked runnable scenario with independent acceptance evidence', async () => {
  const result = discoverRequirement('HIT-12', ledger);
  assert.equal(result.status, 'mapped');
  assert.equal(result.verification, 'discovery-only');
  assert.equal(result.workflows.length, 1);
  const workflow = result.workflows[0];
  assert.equal(workflow.scenario, 'agent-targeting-verification');
  assert.ok(workflow.requirements.includes('HIT-12'));
  assert.ok(workflow.acceptance.some(value => value.includes('item-a')));
  assert.ok(workflow.limits.length);
  for (const path of workflow.sources) await access(resolve(root, path));
  assert.ok(workflow.check.arguments.includes('packages/core/test/agent-targeting-verification.test.ts'));
  workflow.acceptance.length = 0;
  assert.ok(discoverRequirement('HIT-12', ledger).workflows[0].acceptance.length);
});

test('distinguishes known unmapped requirements from invalid IDs without inventing coverage', () => {
  const result = discoverRequirement('RULE-09', ledger);
  assert.equal(result.status, 'unmapped');
  assert.deepEqual(result.workflows, []);
  assert.ok(result.remaining);
  assert.throws(() => discoverRequirement('HIT-999', ledger), { code: 'CRC_UNKNOWN_REQUIREMENT' });
  assert.throws(() => discoverRequirement('HIT-12; echo unsafe', ledger), { code: 'CRC_UNKNOWN_REQUIREMENT' });
});

test('maps analytical correctness to independent arithmetic rather than screenshot similarity', async () => {
  const result = discoverRequirement('DAT-06', ledger);
  assert.equal(result.workflows[0].scenario, 'viz-hover-lab');
  assert.ok(result.workflows[0].acceptance.some(value => value.includes('10 and 30')));
  for (const path of result.workflows[0].sources) await access(resolve(root, path));
  const ids = new Set(ledger.requirements.map(row => row.id));
  for (const id of result.workflows[0].requirements) assert.ok(ids.has(id));
});

test('discovers the completed text and signal workflows with usable evidence and rerun recipes', async () => {
  for (const [id, scenario, replay] of [['TXT-08', 'agent-text-verification', 'text-replay.mjs'], ['SIG-14', 'agent-signal-mutation', 'signal-mutation-replay.mjs']]) {
    const result = discoverRequirement(id, ledger);
    assert.equal(result.status, 'mapped');
    const workflow = result.workflows.find(item => item.scenario === scenario);
    assert.ok(workflow);
    assert.ok(workflow.replay.arguments[0].endsWith(replay));
    assert.ok(workflow.queries.some(query => query.includes('--fields')));
    for (const path of workflow.sources) await access(resolve(root, path));
  }
});

test('finds layout and missingness workflows without inflating their provenance', async () => {
  for (const [id, scenario] of [['LAY-02', 'agent-layout-placement'], ['LAY-06', 'agent-layout-placement'], ['DAT-07', 'viz-hover-lab']]) {
    const result = discoverRequirement(id, ledger);
    assert.equal(result.status, 'mapped');
    assert.equal(result.verification, 'discovery-only');
    const workflow = result.workflows.find(item => item.scenario === scenario);
    assert.ok(workflow);
    for (const path of workflow.sources) await access(resolve(root, path));
    if (id.startsWith('LAY')) {
      assert.ok(workflow.limits.some(value => value.includes('no served-build attestation')));
      assert.ok(workflow.queries.some(value => value.includes('crc-layout-studio-smoke/1')));
      assert.ok(workflow.acceptance.some(value => value.includes('(300,90)')));
      assert.ok(workflow.acceptance.some(value => value.includes('(120,90)')));
    } else {
      assert.ok(workflow.acceptance.some(value => value.includes('zero')));
      assert.ok(workflow.acceptance.some(value => value.includes('25')));
    }
  }
});

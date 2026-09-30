import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readReplayEvidence } from './evidence-reader.mjs';

async function fixture(value, check) {
  const directory = await mkdtemp(join(tmpdir(), 'crc-evidence-reader-'));
  const path = join(directory, 'report.json');
  try { await writeFile(path, typeof value === 'string' ? value : JSON.stringify(value)); await check(path); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
const report = { schema: 'crc-viz-replay/1', status: 'fail', run: { runId: 'run-one', rerun: { arguments: ['fixture'] } },
  steps: [{ actionId: 'hover', status: 'pass', observation: { rows: [1, 2] } }, { actionId: 'resize', status: 'incomplete' }],
  failure: { actionId: 'resize', message: 'anchor mismatch' }, errors: [], droppedErrors: 0 };

test('summary omits bulky observations; explicit action and manifest views retain exact data', async () => {
  await fixture(report, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.verification, 'saved-evidence-only');
    assert.equal(summary.claimedStatus, 'fail');
    assert.equal(summary.actionCount, 2);
    assert.deepEqual(summary.actions, [{ actionId: 'hover', status: 'pass' }, { actionId: 'resize', status: 'incomplete' }]);
    assert.equal(JSON.stringify(summary).includes('rows'), false);
    assert.deepEqual((await readReplayEvidence(path, { actionId: 'hover' })).data, report.steps[0]);
    assert.deepEqual((await readReplayEvidence(path, { manifest: true })).data, report.run);
  });
});

test('checkpoint views cannot promote a completed subset to final success', async () => {
  await fixture({ schema: 'crc-replay-checkpoint/1', status: 'partial', runId: 'run-one', sequence: 3, stage: 'hover', report: { ...report, status: 'pass' } }, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.kind, 'checkpoint');
    assert.equal(summary.claimedStatus, 'partial');
    assert.equal(summary.checkpoint.sequence, 3);
  });
});

test('ambiguous/missing actions and invalid or oversized evidence reject', async () => {
  await fixture({ ...report, steps: [report.steps[0], report.steps[0]] }, async path => {
    await assert.rejects(readReplayEvidence(path, { actionId: 'hover' }), /ambiguous/);
    await assert.rejects(readReplayEvidence(path, { actionId: 'missing' }), /not found/);
  });
  await fixture('{', path => assert.rejects(readReplayEvidence(path), /JSON/));
  await fixture({ schema: 'other' }, path => assert.rejects(readReplayEvidence(path), /schema/));
  await fixture(' '.repeat(4 * 1024 * 1024 + 1), path => assert.rejects(readReplayEvidence(path), /input budget/));
  await fixture({ ...report, steps: [{ actionId: 'huge', status: 'pass', text: 'x'.repeat(70000) }] }, path =>
    assert.rejects(readReplayEvidence(path, { actionId: 'huge' }), /detail budget/));
});

test('summary reports omitted actions explicitly and remains compact', async () => {
  await fixture({ ...report, steps: Array.from({ length: 100 }, (_, index) => ({ actionId: `action-${index}`, status: 'pass', payload: 'x'.repeat(1000) })) }, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.actions.length, 32);
    assert.equal(summary.omittedActions, 68);
    assert.ok(JSON.stringify(summary).length < 12000);
  });
});


test('summary includes secondary failure categories without conflating them with operation errors', async () => {
  await fixture({ ...report, failure: null, observationFailure: { category: 'page-crash' }, completionFailure: { category: 'incomplete-required-actions' }, cleanupFailure: 'close failed' }, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.failure, null);
    assert.deepEqual(summary.otherFailures, { observation: 'page-crash', completion: 'incomplete-required-actions', checkpoint: null, cleanup: 'close failed', verifier: null });
  });
});


test('checkpoint summary preserves clock identity and correlation limits', async () => {
  const timing = { clock: 'node-monotonic', clockId: 'clock-one', elapsedMs: 50,
    anchor: { monotonicMs: 100, wallTimestamp: '2026-09-30T12:00:00.000Z', correlation: 'paired-observations-not-synchronized' } };
  await fixture({ schema: 'crc-replay-checkpoint/1', status: 'partial', report, timing }, async path => {
    assert.deepEqual((await readReplayEvidence(path)).checkpoint.timing, timing);
  });
});

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
    assert.deepEqual(summary.otherFailures, { checkCompletion: null, check: null, observation: 'page-crash', completion: 'incomplete-required-actions', checkpoint: null, cleanup: 'close failed', verifier: null });
  });
});


test('checkpoint summary preserves clock identity and correlation limits', async () => {
  const timing = { clock: 'node-monotonic', clockId: 'clock-one', elapsedMs: 50,
    anchor: { monotonicMs: 100, wallTimestamp: '2026-09-30T12:00:00.000Z', correlation: 'paired-observations-not-synchronized' } };
  await fixture({ schema: 'crc-replay-checkpoint/1', status: 'partial', report, timing }, async path => {
    assert.deepEqual((await readReplayEvidence(path)).checkpoint.timing, timing);
  });
});

test('summarizes explicit non-pass check reasons and refuses unknown outcome enums', async () => {
  const checks = ['pass', 'fail', 'blocked', 'inconclusive', 'skipped', 'not-applicable'].map(status => ({ checkId: status, status, required: false, reason: status === 'pass' ? null : 'Explicit scope condition.' }));
  await fixture({ ...report, checks }, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.checkCount, 6);
    assert.deepEqual(summary.checks, checks);
    assert.equal(summary.omittedChecks, 0);
  });
  await fixture({ ...report, checks: [{ ...checks[0], status: 'unknown' }] }, path => assert.rejects(readReplayEvidence(path), /check outcome/));
  const many = Array.from({ length: 20 }, (_, i) => ({ checkId: `check-${i}`, status: 'skipped', required: false, reason: 'x'.repeat(200) }));
  await fixture({ ...report, checks: many }, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.checks.length, 16); assert.equal(summary.omittedChecks, 4);
    assert.ok(summary.truncatedFields.includes('checks[0].reason'));
  });
});

test('retrieves one identified assertion failure with its action and operands', async () => {
  const check = { checkId: 'repair.entity', actionId: 'repair', required: true, status: 'fail', reason: 'Wrong entity.', failure: { assertion: { expected: 'a', actual: 'b', operator: 'strictEqual' } } };
  await fixture({ ...report, checks: [check], firstFailedCheck: { checkId: check.checkId, actionId: check.actionId } }, async path => {
    assert.deepEqual((await readReplayEvidence(path, { checkId: check.checkId })).data, check);
    const summary = await readReplayEvidence(path);
    assert.equal(summary.firstFailedCheck.checkId, check.checkId);
    assert.equal(summary.checks[0].actionId, 'repair');
    await assert.rejects(readReplayEvidence(path, { checkId: 'missing' }), /not found/);
    await assert.rejects(readReplayEvidence(path, { checkId: check.checkId, actionId: 'hover' }), /either/);
  });
});

test('exposes declared check expectations separately from completed checks', async () => {
  const requiredChecks = [{ checkId: 'resize.bounds', actionId: 'resize' }];
  await fixture({ ...report, requiredChecks, checks: [], checkCompletionFailure: { category: 'incomplete-required-checks', missing: ['resize.bounds'] } }, async path => {
    const summary = await readReplayEvidence(path);
    assert.equal(summary.requiredCheckCount, 1); assert.equal(summary.checkCount, 0);
    assert.equal(summary.otherFailures.checkCompletion, 'incomplete-required-checks');
    assert.deepEqual((await readReplayEvidence(path, { manifest: true })).data.requiredChecks, requiredChecks);
  });
});

test('check expectations alone cannot masquerade as a missing run manifest', async () => {
  await fixture({ ...report, run: undefined, requiredChecks: [{ checkId: 'one', actionId: 'hover' }] }, path =>
    assert.rejects(readReplayEvidence(path, { manifest: true }), /Run manifest not found/));
});

test('pages saved action records with content-bound cursors and explicit checkpoint history', async () => {
  const steps = Array.from({ length: 35 }, (_, index) => ({ actionId: `a-${index}`, status: 'pass', generation: index, payload: 'secret bulky data' }));
  await fixture({ ...report, steps }, async path => {
    const first = await readReplayEvidence(path, { page: 'actions', pageSize: 16 });
    assert.equal(first.view, 'page'); assert.equal(first.total, 35);
    assert.equal(first.data.length, 16); assert.ok(first.nextCursor);
    assert.equal(first.history, 'not-established');
    assert.equal(JSON.stringify(first).includes('secret bulky data'), false);
    const second = await readReplayEvidence(path, { page: 'actions', cursor: first.nextCursor });
    const third = await readReplayEvidence(path, { page: 'actions', cursor: second.nextCursor });
    assert.deepEqual([...first.data, ...second.data, ...third.data].map(x => x.actionId), steps.map(x => x.actionId));
    assert.equal(third.nextCursor, null); assert.equal(third.remaining, 0);
    await writeFile(path, JSON.stringify({ ...report, steps: [...steps, { actionId: 'later' }] }));
    const expired = await readReplayEvidence(path, { page: 'actions', cursor: first.nextCursor });
    assert.equal(expired.status, 'cursor-expired'); assert.deepEqual(expired.data, []);
  });
  await fixture({ schema: 'crc-replay-checkpoint/1', report }, async path => {
    const page = await readReplayEvidence(path, { page: 'actions' });
    assert.equal(page.claimedStatus, 'partial'); assert.equal(page.history, 'checkpoint-prefix');
  });
});

test('bounds pagination and rejects malformed or mismatched cursors instead of silently restarting', async () => {
  await fixture({ ...report, checks: [{ checkId: 'x', status: 'pass', required: true }], steps: [{ actionId: 'a'.repeat(300), status: 'pass' }, { actionId: 'b' }] }, async path => {
    const first = await readReplayEvidence(path, { page: 'actions', pageSize: 1 });
    assert.equal(first.data[0].actionId.length, 128); assert.ok(first.truncatedFields.length);
    await assert.rejects(readReplayEvidence(path, { page: 'checks', cursor: first.nextCursor }), /cursor/);
    await assert.rejects(readReplayEvidence(path, { page: 'actions', cursor: 'not-json' }), /cursor/);
    await assert.rejects(readReplayEvidence(path, { page: 'actions', pageSize: 33 }), /page size/);
    await assert.rejects(readReplayEvidence(path, { cursor: first.nextCursor }), /page/);
    await assert.rejects(readReplayEvidence(path, { page: 'actions', actionId: 'b' }), /Select/);
    const checks = await readReplayEvidence(path, { page: 'checks' });
    assert.deepEqual(checks.data, [{ checkId: 'x', status: 'pass', required: true, reason: null }]);
    assert.equal(checks.nextCursor, null);
  });
});

test('rejects noncanonical encoded cursors rather than accepting whitespace aliases', async () => {
  await fixture(report, async path => {
    const first = await readReplayEvidence(path, { page: 'actions', pageSize: 1 });
    await assert.rejects(readReplayEvidence(path, { page: 'actions', cursor: first.nextCursor + '\n' }), /cursor/);
    const repeated = await readReplayEvidence(path, { page: 'actions', cursor: first.nextCursor });
    assert.equal(repeated.data[0].actionId, 'resize');
  });
});

test('reads text and signal mutation evidence through the shared summary and identified check views', async () => {
  for (const schema of ['crc-text-replay/1', 'crc-signal-mutation-replay/1']) {
    const check = { checkId: 'repair.assertion', actionId: 'repair', status: 'pass', required: true, reason: null };
    await fixture({ ...report, schema, status: 'pass', checks: [check] }, async path => {
      const summary = await readReplayEvidence(path);
      assert.equal(summary.sourceSchema, schema);
      assert.equal(summary.claimedStatus, 'pass');
      assert.deepEqual((await readReplayEvidence(path, { checkId: check.checkId })).data, check);
    });
  }
});

test('projects requested fields from oversized action evidence without returning unrelated payloads', async () => {
  await fixture({ ...report, steps: [{ actionId: 'large', status: 'pass', state: { amount: 42, optional: null, rows: Array.from({ length: 1000 }, (_, id) => ({ id, secret: 'unrequested payload'.repeat(20) })) } }] }, async path => {
    const view = await readReplayEvidence(path, { actionId: 'large', fields: ['/state/amount', '/state/optional', '/state/missing', '/state/rows', '/state/rows/999/id'] });
    assert.equal(view.view, 'projection');
    assert.equal(view.parent, 'action');
    assert.deepEqual(view.data.slice(0, 3), [
      { path: '/state/amount', status: 'value', value: 42 },
      { path: '/state/optional', status: 'value', value: null },
      { path: '/state/missing', status: 'absent' },
    ]);
    assert.deepEqual(view.data[3], { path: '/state/rows', status: 'summary', kind: 'array', length: 1000 });
    assert.deepEqual(view.data[4], { path: '/state/rows/999/id', status: 'value', value: 999 });
    assert.ok(!JSON.stringify(view).includes('unrequested payload'));
    assert.ok(JSON.stringify(view).length < 2000);
    assert.match(view.snapshot, /^[a-f0-9]{64}$/);
  });
});

test('projection uses own JSON fields, escapes pointer tokens, distinguishes special numbers and bounds strings', async () => {
  const step = JSON.parse('{"actionId":"special","status":"pass","negativeZero":-0,"overflow":1e999,"a/b":{"~key":false},"__proto__":{"safe":"own"}}');
  step.long = 'x'.repeat(10000);
  // Pass raw JSON so the negative zero and overflowing source literal are retained.
  const raw = JSON.stringify({ ...report, steps: [step] }).replace('"negativeZero":0', '"negativeZero":-0').replace('"overflow":null', '"overflow":1e999');
  await fixture(raw, async path => {
    const view = await readReplayEvidence(path, { actionId: 'special', fields: ['/a~1b/~0key', '/__proto__/safe', '/constructor', '/negativeZero', '/overflow', '/long'] });
    assert.deepEqual(view.data[0], { path: '/a~1b/~0key', status: 'value', value: false });
    assert.equal(view.data[1].value, 'own'); assert.equal(view.data[2].status, 'absent');
    assert.deepEqual(view.data[3], { path: '/negativeZero', status: 'special-number', value: '-0' });
    assert.deepEqual(view.data[4], { path: '/overflow', status: 'special-number', value: 'Infinity' });
    assert.equal(view.data[5].status, 'truncated'); assert.equal(view.data[5].value.length, 1024); assert.equal(view.data[5].length, 10000);
  });
});

test('invalid field selectors and unsupported versions have machine-readable errors', async () => {
  await fixture(report, async path => {
    for (const fields of [[], ['bad'], ['/bad~2escape'], Array(17).fill('/state'), ['/state', '/state'], ['/' + 'x'.repeat(512)], ['/' + Array(17).fill('x').join('/')]]) {
      await assert.rejects(readReplayEvidence(path, { actionId: 'hover', fields }), error => error.code === 'CRC_EVIDENCE_INVALID_SELECTOR');
    }
    await assert.rejects(readReplayEvidence(path, { fields: ['/status'] }), error => error.code === 'CRC_EVIDENCE_INVALID_SELECTOR');
  });
  await fixture({ ...report, schema: 'crc-text-replay/2' }, path => assert.rejects(readReplayEvidence(path), error => error.code === 'CRC_EVIDENCE_UNSUPPORTED_SCHEMA'));
});

test('CLI projects real retained signal evidence and exposes structured selector failures', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const cli = fileURLToPath(new URL('./evidence-reader.mjs', import.meta.url));
  const artifact = fileURLToPath(new URL('../../docs/strategy/agent-verification-evidence/sig-14-replay.json', import.meta.url));
  const result = spawnSync(process.execPath, [cli, artifact, '--action', 'replacement', '--fields', JSON.stringify(['/state/sourceAmount', '/state/evaluatedAmount', '/state/diagnosis'])], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  const view = JSON.parse(result.stdout);
  assert.equal(view.verification, 'saved-evidence-only');
  assert.equal(view.sourceSchema, 'crc-signal-mutation-replay/1');
  assert.deepEqual(view.data.map(field => field.value), [42, 42, 'replacement-published']);
  for (const arguments_ of [['--action', 'replacement', '--fields', '{}'], ['--fields', '[]'], ['--manifest', '--check', 'anything'], ['--wat']]) {
    const failed = spawnSync(process.execPath, [cli, artifact, ...arguments_], { encoding: 'utf8', timeout: 5000 });
    assert.equal(failed.status, 1);
    assert.equal(JSON.parse(failed.stdout).code, 'CRC_EVIDENCE_INVALID_SELECTOR');
  }
});

test('projection bounds object-key previews and enforces output bytes even for worst-case escaping', async () => {
  const object = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['long-key-' + i + 'x'.repeat(100), i]));
  await fixture({ ...report, steps: [{ actionId: 'keys', status: 'pass', object }] }, async path => {
    const selected = (await readReplayEvidence(path, { actionId: 'keys', fields: ['/object'] })).data[0];
    assert.equal(selected.status, 'summary'); assert.equal(selected.propertyCount, 20);
    assert.equal(selected.keys.length, 8); assert.equal(selected.omittedKeys, 12);
    assert.equal(selected.keys[0].value.length, 64); assert.equal(selected.keys[0].truncated, true);
  });
  const strings = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`s${i}`, '\u0000'.repeat(1024)]));
  await fixture({ ...report, steps: [{ actionId: 'escaped', status: 'pass', ...strings }] }, path =>
    assert.rejects(readReplayEvidence(path, { actionId: 'escaped', fields: Object.keys(strings).map(key => '/' + key) }), error => error.code === 'CRC_EVIDENCE_BUDGET_EXCEEDED'));
});

test('preserves redacted failure reasons and stages without inventing an assertion message', async () => {
  await fixture({ schema: 'crc-text-replay/1', status: 'blocked', steps: [], failure: { stage: 'initial', reason: 'Unvalidated payload omitted.', code: 'CRC_FIXTURE_IDENTITY_MISMATCH' } }, async path => {
    const view = await readReplayEvidence(path);
    assert.equal(view.failure.reason, 'Unvalidated payload omitted.');
    assert.equal(view.failure.stage, 'initial');
    assert.equal(view.failure.code, 'CRC_FIXTURE_IDENTITY_MISMATCH');
    assert.equal(view.failure.message, null);
  });
});

test('reads layout smoke actions without inventing per-action success or attestation', async () => {
 const smoke={schema:'crc-layout-studio-smoke/1',status:'pass',steps:[{action:'overlap-prohibited',before:{assertion:'fail'},after:{relations:{overlap:{area:200}},clicks:4}}],errors:[]};
 await fixture(smoke,async path=>{
  const summary=await readReplayEvidence(path);
  assert.equal(summary.attestation,'not-provided-by-schema');
  assert.equal(summary.verification,'saved-evidence-only');
  assert.deepEqual(summary.actions,[{actionId:'overlap-prohibited',status:null}]);
  assert.equal(summary.manifestAvailable,false);assert.equal(summary.requiredCheckCount,null);
  assert.deepEqual((await readReplayEvidence(path,{actionId:'overlap-prohibited'})).data,smoke.steps[0]);
  const projection=await readReplayEvidence(path,{actionId:'overlap-prohibited',fields:['/before/assertion','/after/relations/overlap/area']});
  assert.equal(projection.attestation,'not-provided-by-schema');
  assert.deepEqual(projection.data.map(item=>item.value),['fail',200]);
  assert.equal((await readReplayEvidence(path,{page:'actions'})).data[0].actionId,'overlap-prohibited');
  await assert.rejects(readReplayEvidence(path,{manifest:true}),{code:'CRC_EVIDENCE_NO_MATCH'});
 });
 await fixture({...smoke,status:'fail',error:'Controlled smoke failure'},async path=>assert.equal((await readReplayEvidence(path)).failure.message,'Controlled smoke failure'));
 for(const invalid of [{...smoke,run:{runId:'invented'}},{...smoke,checks:[]},{...smoke,steps:[{actionId:'wrong-field'}]}])await fixture(invalid,path=>assert.rejects(readReplayEvidence(path),{code:'CRC_EVIDENCE_INVALID_DOCUMENT'}));
 await fixture({...smoke,schema:'crc-layout-studio-smoke/2'},path=>assert.rejects(readReplayEvidence(path),{code:'CRC_EVIDENCE_UNSUPPORTED_SCHEMA'}));
});

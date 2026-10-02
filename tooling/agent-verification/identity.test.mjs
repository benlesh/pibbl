import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprint, assertIdentity } from './identity.mjs';

test('served identity rejects different fixture bytes even with the same revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'crc-identity-'));
  try {
    await mkdir(join(root, 'fixture'));
    await writeFile(join(root, 'fixture/app.ts'), 'export const selected = 1;');
    const expected = await fingerprint(root, ['fixture/app.ts'], 'revision-a');
    assertIdentity(expected, JSON.parse(JSON.stringify(expected)));
    await writeFile(join(root, 'fixture/app.ts'), 'export const selected = 2;');
    const served = await fingerprint(root, ['fixture/app.ts'], 'revision-a');
    assert.throws(() => assertIdentity(expected, served), /identity mismatch/);
    assert.throws(() => assertIdentity(expected, null), { code: 'CRC_FIXTURE_IDENTITY_UNAVAILABLE' });
    assert.throws(() => assertIdentity(expected, { ...expected, revision: 'other' }), /identity mismatch/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { targetingIdentityPlugin } from './identity-plugin.mjs';
import { sourceIdentity, fixturePath, vizFixturePath, identityMarker } from './identity.mjs';

const repository = resolve(import.meta.dirname, '../..');
test('identity is embedded in the loaded fixture only for source development', async () => {
  const plugin = targetingIdentityPlugin(repository);
  assert.equal(plugin.apply({}, { command: 'build', mode: 'production' }), false);
  assert.equal(plugin.apply({}, { command: 'serve', mode: 'built' }), false);
  assert.equal(plugin.apply({}, { command: 'serve', mode: 'development' }), true);
  const source = await readFile(resolve(repository, fixturePath), 'utf8');
  const transformed = await plugin.transform(source, resolve(repository, fixturePath));
  const identity = await sourceIdentity(repository);
  assert.ok(transformed.code.includes(JSON.stringify(identity)));
  assert.ok(!transformed.code.includes(identityMarker));
  assert.equal(await plugin.transform(source, '/unrelated.ts'), null);
  const vizSource = await readFile(resolve(repository, vizFixturePath), 'utf8');
  const vizTransformed = await plugin.transform(vizSource, resolve(repository, vizFixturePath));
  const vizIdentity = await sourceIdentity(repository, 'viz');
  assert.ok(vizTransformed.code.includes(JSON.stringify(vizIdentity)));
  assert.ok(!vizTransformed.code.includes(identityMarker));
  assert.notEqual(vizIdentity.sha256, identity.sha256);
  assert.ok(vizIdentity.files > identity.files);
});

test('native replay blocks a mismatched served fixture before exercising actions', { timeout: 30000 }, async () => {
  const output = await mkdtemp(join(tmpdir(), 'crc-mismatch-'));
  const wrong = { ...(await sourceIdentity(repository)), sha256: '0'.repeat(64) };
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<script type="application/json" data-testid="agent-targeting-evidence">${JSON.stringify({ schema: 'crc-targeting-fixture/1', identity: wrong, state: {} })}</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const child = spawn(process.execPath, ['tooling/agent-verification/replay.mjs', `http://127.0.0.1:${server.address().port}`, output], { cwd: repository, stdio: 'pipe' });
    let diagnostics = '';
    child.stdout.on('data', chunk => { diagnostics += chunk; });
    child.stderr.on('data', chunk => { diagnostics += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 25000);
    let code;
    try { code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); }
    finally { clearTimeout(timer); }
    assert.equal(code, 1, diagnostics);
    const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
    assert.equal(report.status, 'blocked');
    assert.deepEqual(report.run.toolIdentityAfter, report.run.toolIdentity);
    assert.equal(report.toolVerification.status, 'matching-on-disk');
    assert.match(report.failure.message, /identity mismatch/);
    assert.equal(report.failure.code, 'CRC_FIXTURE_IDENTITY_MISMATCH');
    assert.equal(report.run.environment.observedPage.status, 'observed');
    assert.deepEqual(report.run.environment.observedPage.viewportCss, { width: 1280, height: 1000 });
    assert.deepEqual(report.steps, []);
    assert.equal(report.servedIdentity.sha256, wrong.sha256);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(output, { recursive: true, force: true });
  }
});

test('visualization replay blocks a mismatched served fixture before exercising actions', { timeout: 30000 }, async () => {
  const output = await mkdtemp(join(tmpdir(), 'crc-mismatch-'));
  const wrong = { ...(await sourceIdentity(repository, 'viz')), sha256: '0'.repeat(64) };
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<script type="application/json" data-testid="agent-viz-evidence">${JSON.stringify({ schema: 'crc-viz-fixture/1', identity: wrong, state: {} })}</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const child = spawn(process.execPath, ['tooling/agent-verification/viz-replay.mjs', `http://127.0.0.1:${server.address().port}`, output], { cwd: repository, stdio: 'pipe' });
    let diagnostics = '';
    child.stdout.on('data', chunk => { diagnostics += chunk; });
    child.stderr.on('data', chunk => { diagnostics += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 25000);
    let code;
    try { code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); }
    finally { clearTimeout(timer); }
    assert.equal(code, 1, diagnostics);
    const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
    assert.equal(report.status, 'blocked');
    assert.deepEqual(report.run.toolIdentityAfter, report.run.toolIdentity);
    assert.equal(report.toolVerification.status, 'matching-on-disk');
    assert.match(report.failure.message, /identity mismatch/);
    assert.equal(report.failure.code, 'CRC_FIXTURE_IDENTITY_MISMATCH');
    assert.equal(report.run.environment.observedPage.status, 'observed');
    assert.deepEqual(report.run.environment.observedPage.viewportCss, { width: 1280, height: 1000 });
    assert.deepEqual(report.steps, []);
    assert.equal(report.servedIdentity.sha256, wrong.sha256);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(output, { recursive: true, force: true });
  }
});


test('native replay retains structured assertion evidence from a controlled fixture', { timeout: 30000 }, async () => {
  const output = await mkdtemp(join(tmpdir(), 'crc-assertion-evidence-'));
  const identity = await sourceIdentity(repository);
  const server = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<script type="application/json" data-testid="agent-targeting-evidence">${JSON.stringify({
      schema: 'crc-targeting-fixture/1', identity, state: { inspectionAvailability: 'unsupported-test-fixture' },
    })}</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const child = spawn(process.execPath, ['tooling/agent-verification/replay.mjs', `http://127.0.0.1:${server.address().port}`, output], { cwd: repository, stdio: 'pipe' });
    let diagnostics = '';
    child.stdout.on('data', chunk => { diagnostics += chunk; });
    child.stderr.on('data', chunk => { diagnostics += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 25000);
    let code;
    try { code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); }); }
    finally { clearTimeout(timer); }
    assert.equal(code, 1, diagnostics);
    const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
    assert.equal(report.status, 'blocked');
    assert.deepEqual(report.run.toolIdentityAfter, report.run.toolIdentity);
    assert.equal(report.toolVerification.status, 'matching-on-disk');
    assert.equal(report.failure.code, 'ERR_ASSERTION');
    assert.equal(report.failure.assertion.operator, 'strictEqual');
    assert.equal(report.failure.assertion.expected, 'source-runtime');
    assert.equal(report.failure.assertion.actual, 'unsupported-test-fixture');
    assert.equal(report.failure.actionId, null);
    assert.deepEqual(report.failure.detail.omissions, []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(output, { recursive: true, force: true });
  }
});

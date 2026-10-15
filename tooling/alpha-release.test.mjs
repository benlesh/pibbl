import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';

test('continuous publish requires a successful main push, opt-in, and scoped OIDC', () => {
  const workflow = parse(readFileSync('.github/workflows/trust.yml', 'utf8'));
  const job = workflow.jobs['publish-alpha'];
  assert.ok(job);
  assert.deepEqual(job.needs, ['trust-gate']);
  for (const guard of ["github.event_name == 'push'", "github.ref == 'refs/heads/main'", "vars.CONTINUOUS_ALPHA == 'true'"]) assert.ok(job.if.includes(guard));
  assert.equal(job.permissions['id-token'], 'write');
  assert.equal(workflow.permissions['id-token'], undefined);
  assert.equal(job.environment, 'npm-alpha');
  assert.ok(job.steps.some(step => step.id === 'alpha-inputs' && step.run === 'node tooling/alpha-inputs.mjs'));
  for (const name of ['Prepare unique alpha version', 'Build release packages', 'Publish current main alpha']) assert.equal(job.steps.find(step => step.name === name).if, "steps.alpha-inputs.outputs.changed == 'true'");
  assert.equal(job.steps.find(step => step.name === 'Publish current main alpha').env.PIBBL_ALPHA_INPUT_HASH, '${{ steps.alpha-inputs.outputs.hash }}');
  assert.equal(job.concurrency['cancel-in-progress'], false);
});

test('alpha publishing rejects stable versions and never promotes latest', () => {
  const root = mkdtempSync(join(tmpdir(), 'pibbl-alpha-'));
  try {
    mkdirSync(join(root, 'tooling'));
    mkdirSync(join(root, 'bin'));
    copyFileSync('tooling/publish-release.mjs', join(root, 'tooling/publish-release.mjs'));
    for (const command of ['npm', 'corepack']) {
      writeFileSync(join(root, 'bin', command), `#!${process.execPath}\nif(process.argv[2]==='--version'){process.stdout.write(process.env.TEST_NPM_VERSION || '11.19.1');process.exit(0);}
require('node:fs').appendFileSync(process.env.CALL_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');\n`, { mode: 0o755 });
    }
    const manifests = version => {
      for (const name of ['core', 'three', 'text', 'pibbl']) {
        const dir = join(root, 'packages', name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: name === 'pibbl' ? name : `@pibbl/${name}`, version }));
        writeFileSync(join(dir, 'README.md'), 'ALPHA — NOT FOR PRODUCTION USE');
      }
    };
    const log = join(root, 'calls');
    const run = () => execFileSync(process.execPath, [join(root, 'tooling/publish-release.mjs'), '--alpha'], { env: { ...process.env, PATH: `${join(root, 'bin')}:${process.env.PATH}`, CALL_LOG: log, PIBBL_ALPHA_INPUT_HASH: 'a'.repeat(64) }, stdio: 'pipe' });
    manifests('0.0.3-alpha.123.1');
    run();
    const calls = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    const publishes = calls.filter(args => args[0] === 'publish');
    assert.equal(publishes.length, 4);
    for (const name of ['core', 'three', 'text', 'pibbl']) assert.equal(JSON.parse(readFileSync(join(root, 'packages', name, 'package.json'))).pibblAlphaInputHash, 'a'.repeat(64));
    for (const args of publishes) assert.equal(args.at(-1), 'alpha');
    assert.ok(calls.every(args => args[0] !== 'dist-tag'));
    writeFileSync(log, '');
    const previous = process.env.TEST_NPM_VERSION;
    process.env.TEST_NPM_VERSION = '10.9.9';
    try { assert.throws(run, /npm 11.5.1 or newer/); }
    finally { if (previous === undefined) delete process.env.TEST_NPM_VERSION; else process.env.TEST_NPM_VERSION = previous; }
    assert.equal(readFileSync(log, 'utf8'), '', 'old npm must fail before packing or publication');
    manifests('0.0.3');
    assert.throws(run);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

 test('publishing installs npm into a PATH-preferred isolated prefix', () => {
  const workflow = parse(readFileSync('.github/workflows/trust.yml', 'utf8'));
  for (const id of ['publish-alpha', 'npm-auth-check']) {
    const install = workflow.jobs[id].steps.find(step => step.run?.includes('npm install --global'));
    assert.ok(install.run.includes('--prefix "$RUNNER_TEMP/pibbl-publishing-tools"'));
    assert.ok(install.run.includes('"$RUNNER_TEMP/pibbl-publishing-tools/bin" >> "$GITHUB_PATH"'));
  }
});

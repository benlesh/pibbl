import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parse } from 'yaml';
import { checkNpmPublishingAuth } from './npm-publishing-auth.mjs';

const env = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://actions.example/token', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'runner-secret' };
test('checks all four package exchanges without publishing or disclosing credentials', async () => {
  const calls = [], output = [];
  await checkNpmPublishingAuth({ env, report: line => output.push(line), request: async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json(calls.length === 1 ? { value: 'identity-secret' } : { token: 'npm-secret' });
  } });
  assert.equal(calls.length, 5);
  assert.equal(new URL(calls[0].url).searchParams.get('audience'), 'npm:registry.npmjs.org');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer runner-secret');
  for (const call of calls.slice(1)) {
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.headers.Authorization, 'Bearer identity-secret');
    assert.ok(call.url.includes('/oidc/token/exchange/package/'));
  }
  assert.equal(output.length, 4);
  assert.doesNotMatch(output.join('\n'), /runner-secret|identity-secret|npm-secret/);
});
test('reports the registry rejection while redacting credentials', async () => {
  let calls = 0;
  await assert.rejects(checkNpmPublishingAuth({ env, report() {}, request: async () => {
    calls++;
    return calls === 1 ? Response.json({ value: 'identity-secret' }) : Response.json({ message: 'Publisher mismatch identity-secret runner-secret' }, { status: 401 });
  } }), /@pibbl\/core: npm HTTP 401: Publisher mismatch \[redacted\] \[redacted\]/);
});
test('missing OIDC permissions fail before making a request', async () => {
  await assert.rejects(checkNpmPublishingAuth({ env: {}, request() { assert.fail('must not request'); } }), /id-token: write/);
});
test('manual auth diagnosis cannot publish or replace the normal trust gate', () => {
  const workflow = parse(readFileSync('.github/workflows/trust.yml', 'utf8'));
  assert.equal(workflow.on.workflow_dispatch.inputs.check_npm_auth.default, false);
  const job = workflow.jobs['npm-auth-check'];
  assert.equal(job.if, "github.event_name == 'workflow_dispatch' && inputs.check_npm_auth == true");
  assert.equal(job.environment, 'npm-alpha');
  assert.equal(job.permissions['id-token'], 'write');
  assert.ok(job.steps.some(step => step.run === 'node tooling/npm-publishing-auth.mjs'));
  for (const step of job.steps.filter(step => /npm publish/.test(step.run ?? ''))) assert.ok(step.run.includes('--dry-run'));
  assert.ok(job.steps.some(step => step.run?.includes('pnpm exec npm publish') && step.run.includes('--loglevel=verbose')));
  assert.equal(workflow.jobs.contracts.if, "github.event_name != 'workflow_dispatch' || inputs.check_npm_auth != true");
  assert.equal(workflow.jobs['trust-gate'].if, "always() && (github.event_name != 'workflow_dispatch' || inputs.check_npm_auth != true)");
  assert.deepEqual(workflow.jobs['publish-alpha'].needs, ['trust-gate']);
  assert.ok(workflow.jobs['publish-alpha'].if.includes("github.event_name == 'push'"));
});

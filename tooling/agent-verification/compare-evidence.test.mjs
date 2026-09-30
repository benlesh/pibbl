import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareReplayReports } from './compare-evidence.mjs';
const identity = { schema: 'crc-targeting-identity/1', revision: 'revision', sha256: 'a'.repeat(64), files: 10 };
const tool = { ...identity, schema: 'crc-replay-tool-identity/1' };
function report() { return { schema: 'crc-viz-replay/1', status: 'pass', url: 'http://localhost/#/testing/viz-hover-lab', browser: 'chromium-test', expectedIdentity: identity, servedIdentity: identity,
  run: { schema: 'crc-replay-run/1', runId: 'first', kind: 'viz', environment: { node: 'v24', platform: 'test', architecture: 'test', browserContext: { viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1, locale: 'en-US', timezoneId: 'UTC', reducedMotion: 'reduce', colorScheme: 'light' } }, toolIdentity: tool, toolIdentityAfter: tool },
  requiredActions: ['hover'], steps: [{ actionId: 'hover', status: 'pass', state: { selected: 'a' } }] }; }

test('compares recorded actions while ignoring independent run IDs', () => {
  const before = report(), after = structuredClone(before); after.run.runId = 'second';
  assert.equal(compareReplayReports(before, after).status, 'comparable');
  assert.equal(compareReplayReports(before, after).actions[0].evidenceChanged, false);
  after.steps[0].state.selected = 'b';
  assert.equal(compareReplayReports(before, after).actions[0].evidenceChanged, true);
});

test('refuses missing or differing provenance rather than silently comparing unlike runs', () => {
  for (const mutate of [
    value => { delete value.run.toolIdentity; },
    value => { delete value.run.environment.browserContext.viewport; },
    value => { value.run.toolIdentityAfter.sha256 = 'b'.repeat(64); },
    value => { value.servedIdentity.sha256 = 'b'.repeat(64); },
    value => { value.run.environment.browserContext.deviceScaleFactor = 2; },
    value => { value.browser = 'other'; },
    value => { value.url = 'http://other/'; },
    value => { value.status = 'incomplete'; },
    value => { value.steps.push(value.steps[0]); },
  ]) {
    const before = report(), after = structuredClone(report()); mutate(after);
    const result = compareReplayReports(before, after);
    assert.equal(result.status, 'incomparable');
    assert.ok(result.reasons.length > 0);
    assert.equal(result.actions, undefined);
  }
});


test('compares recorded failure changes and refuses a pass with unfinished actions', () => {
  const before = report(), after = structuredClone(before);
  after.status = 'fail'; after.steps[0].status = 'incomplete'; after.failure = { message: 'selection failed' };
  const result = compareReplayReports(before, after);
  assert.equal(result.status, 'comparable');
  assert.equal(result.failureEvidenceChanged, true);
  assert.deepEqual(result.outcome, { before: 'pass', after: 'fail' });
  after.status = 'pass';
  assert.ok(compareReplayReports(before, after).reasons.includes('after:contradictory-pass'));
});

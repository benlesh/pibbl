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
<<<<<<< HEAD

const observed = () => ({ status: 'observed', scope: 'page-reported-at-capture',
  viewportCss: { width: 1280, height: 1000 }, devicePixelRatio: 1, visualViewportScale: 1,
  browserZoom: 'unavailable', language: 'en-US', timezone: 'UTC',
  preferences: { dark: false, reducedMotion: true } });

test('refuses equally unavailable or malformed observed environments', () => {
  for (const mutate of [
    () => ({ status: 'unavailable', failure: { message: 'page closed' } }),
    () => null,
    value => ({ ...value, viewportCss: { width: 0, height: 1000 } }),
    value => ({ ...value, devicePixelRatio: NaN }),
    value => ({ ...value, preferences: { dark: 'false', reducedMotion: true } }),
    value => ({ ...value, visualViewportScale: -1 }),
    value => ({ ...value, language: '' }),
  ]) {
    const before = report(); before.run.environment.observedPage = mutate(observed());
    const after = structuredClone(before);
    const result = compareReplayReports(before, after);
    assert.equal(result.status, 'incomparable');
    assert.ok(result.reasons.includes('before:observed-environment-unavailable-or-invalid'));
    assert.equal(result.actions, undefined);
  }
});

test('labels declared-only comparisons and compares observed facts when available', () => {
  const before = report(), after = structuredClone(before);
  assert.equal(compareReplayReports(before, after).environmentScope, 'declared-only');
  before.run.environment.observedPage = observed();
  assert.equal(compareReplayReports(before, after).status, 'incomparable');
  after.run.environment.observedPage = observed();
  assert.equal(compareReplayReports(before, after).environmentScope, 'declared-and-initial-page-observation');
  assert.equal(compareReplayReports(before, after).status, 'comparable');
  after.run.environment.observedPage.preferences.dark = true;
  assert.ok(compareReplayReports(before, after).reasons.includes('environment:differs'));
});
=======
>>>>>>> origin/main

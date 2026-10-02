import { validCheckOutcomes, requiredCheckFailure } from './replay-outcome.mjs';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readReplayDocument } from './evidence-reader.mjs';

function identity(value, schema) {
  return value?.schema === schema && typeof value.revision === 'string' && value.revision.length > 0 &&
    typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256) && Number.isSafeInteger(value.files) && value.files > 0;
}

function validObservedEnvironment(value) {
  const positive = number => Number.isFinite(number) && number > 0;
  const text = value => typeof value === 'string' && value.length > 0 && value.length <= 128;
  return value?.status === 'observed' && value.scope === 'page-reported-at-capture' &&
    positive(value.viewportCss?.width) && positive(value.viewportCss?.height) &&
    positive(value.devicePixelRatio) && (value.visualViewportScale === null || positive(value.visualViewportScale)) &&
    value.browserZoom === 'unavailable' && text(value.language) && text(value.timezone) &&
    typeof value.preferences?.dark === 'boolean' && typeof value.preferences?.reducedMotion === 'boolean';
}

/** Compare recorded data, never certify results or infer a causal regression. */
export function compareReplayReports(before, after) {
  const reasons = [];
  for (const [side, value] of [['before', before], ['after', after]]) {
    if (!['crc-targeting-replay/1', 'crc-viz-replay/1'].includes(value?.schema)) { reasons.push(`${side}:unsupported-schema`); continue; }
    if (!['pass', 'fail'].includes(value.status)) reasons.push(`${side}:not-final-outcome`);
    if (!identity(value.expectedIdentity, 'crc-targeting-identity/1') || !identity(value.servedIdentity, 'crc-targeting-identity/1') ||
      !isDeepStrictEqual(value.expectedIdentity, value.servedIdentity)) reasons.push(`${side}:fixture-provenance-incomplete-or-inconsistent`);
    if (!identity(value.run?.toolIdentity, 'crc-replay-tool-identity/1') || !identity(value.run?.toolIdentityAfter, 'crc-replay-tool-identity/1') ||
      !isDeepStrictEqual(value.run.toolIdentity, value.run.toolIdentityAfter)) reasons.push(`${side}:tool-provenance-incomplete-or-inconsistent`);
    if (value.run?.schema !== 'crc-replay-run/1' || typeof value.run.runId !== 'string' || value.run.runId.length > 128 ||
      value.run.kind !== (value.schema === 'crc-viz-replay/1' ? 'viz' : 'targeting')) reasons.push(`${side}:run-manifest-incomplete`);
    const environment = value.run?.environment;
    if (!environment || !['node', 'platform', 'architecture'].every(key => typeof environment[key] === 'string') || !environment.browserContext ||
      !['width', 'height'].every(key => Number.isFinite(environment.browserContext.viewport?.[key]) && environment.browserContext.viewport[key] > 0) ||
      !Number.isFinite(environment.browserContext.deviceScaleFactor) || environment.browserContext.deviceScaleFactor <= 0 ||
      !['locale', 'timezoneId', 'reducedMotion', 'colorScheme'].every(key => typeof environment.browserContext[key] === 'string') ||
      typeof value.browser !== 'string' || typeof value.url !== 'string') reasons.push(`${side}:environment-incomplete`);
    if (environment && Object.hasOwn(environment, 'observedPage') && !validObservedEnvironment(environment.observedPage)) {
      reasons.push(`${side}:observed-environment-unavailable-or-invalid`);
    }
    if (value.checks !== undefined) {
      if (!validCheckOutcomes(value.checks)) reasons.push(`${side}:invalid-check-outcomes`);
      else if (value.status === 'pass' && value.checks.some(check => check.status === 'fail' || (check.required && check.status !== 'pass'))) reasons.push(`${side}:contradictory-check-pass`);
    }
    if (value.requiredChecks !== undefined) {
      const failure = requiredCheckFailure(value.requiredChecks, value.checks);
      if (failure && (value.status === 'pass' || failure.category === 'invalid-required-check-manifest')) reasons.push(`${side}:${failure.category}`);
    }
    const required = value.requiredActions;
    if (!Array.isArray(required) || !required.length || required.length > 128 || required.some(id => typeof id !== 'string' || !id || id.length > 128) || new Set(required).size !== required.length) {
      reasons.push(`${side}:action-manifest-invalid`);
    } else if (!Array.isArray(value.steps) || value.steps.length > required.length || value.steps.some((step, index) => step?.actionId !== required[index] || !['pass', 'fail', 'incomplete'].includes(step.status))) {
      reasons.push(`${side}:action-evidence-invalid`);
    } else if (value.status === 'pass' && (value.steps.length !== required.length || value.steps.some(step => step.status !== 'pass'))) {
      reasons.push(`${side}:contradictory-pass`);
    }
  }
  for (const [name, left, right] of [
    ['schema', before?.schema, after?.schema], ['fixture-build', before?.expectedIdentity, after?.expectedIdentity],
    ['verifier-build', before?.run?.toolIdentity, after?.run?.toolIdentity], ['environment', before?.run?.environment, after?.run?.environment],
    ['browser', before?.browser, after?.browser], ['fixture-url', before?.url, after?.url], ['action-manifest', before?.requiredActions, after?.requiredActions],
    ['check-manifest', before?.requiredChecks, after?.requiredChecks],
  ]) if (!isDeepStrictEqual(left, right)) reasons.push(`${name}:differs`);
  const base = { schema: 'crc-replay-comparison/1', verification: 'saved-evidence-only',
    environmentScope: before?.run?.environment?.observedPage === undefined && after?.run?.environment?.observedPage === undefined ? 'declared-only' : 'declared-and-initial-page-observation',
    runs: { before: typeof before?.run?.runId === 'string' ? before.run.runId.slice(0, 128) : null, after: typeof after?.run?.runId === 'string' ? after.run.runId.slice(0, 128) : null },
    scope: 'Exact recorded action data under matching declared provenance; not causal or pixel-equivalence proof.' };
  if (reasons.length) return { ...base, status: 'incomparable', reasons };
  return { ...base, status: 'comparable', outcome: { before: before.status, after: after.status },
    checksChanged: !isDeepStrictEqual(before.checks, after.checks),
    failureEvidenceChanged: !isDeepStrictEqual(
      ['checkCompletionFailure', 'checkFailure', 'failure', 'observationFailure', 'completionFailure', 'checkpointFailure', 'cleanupFailure', 'errors', 'droppedErrors', 'toolVerification'].map(key => before[key]),
      ['checkCompletionFailure', 'checkFailure', 'failure', 'observationFailure', 'completionFailure', 'checkpointFailure', 'cleanupFailure', 'errors', 'droppedErrors', 'toolVerification'].map(key => after[key]),
    ),
    actions: before.requiredActions.map((actionId, index) => ({ actionId,
      before: before.steps[index]?.status ?? 'not-recorded', after: after.steps[index]?.status ?? 'not-recorded',
      evidenceChanged: !isDeepStrictEqual(before.steps[index], after.steps[index]),
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [beforePath, afterPath, ...extra] = process.argv.slice(2);
    if (!beforePath || !afterPath || extra.length) throw new Error('Usage: node compare-evidence.mjs BEFORE.json AFTER.json');
    const [before, after] = await Promise.all([readReplayDocument(beforePath), readReplayDocument(afterPath)]);
    if (before.checkpoint || after.checkpoint) throw new Error('Checkpoint evidence cannot establish a final run comparison.');
    const comparison = compareReplayReports(before.report, after.report);
    process.stdout.write(JSON.stringify({ ...comparison, sources: { before: before.source, after: after.source } }) + '\n');
    if (comparison.status !== 'comparable') process.exitCode = 1;
  } catch (error) {
    process.stdout.write(JSON.stringify({ schema: 'crc-replay-comparison/1', status: 'unavailable', message: error.message.slice(0, 1024) }) + '\n');
    process.exitCode = 1;
  }
}

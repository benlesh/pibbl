const checkStatuses = new Set(['pass', 'fail', 'blocked', 'inconclusive', 'skipped', 'not-applicable']);

/** Structural validation of recorded checks, never an assertion oracle. */
export function validCheckOutcomes(checks) {
  if (!Array.isArray(checks) || checks.length > 256) return false;
  const ids = new Set();
  for (const check of checks) {
    if (!check || typeof check.checkId !== 'string' || !check.checkId.trim() || check.checkId.length > 128 || ids.has(check.checkId) ||
        !checkStatuses.has(check.status) || typeof check.required !== 'boolean' ||
        (check.status !== 'pass' && (typeof check.reason !== 'string' || !check.reason.trim())) ||
        (check.reason !== null && check.reason !== undefined && (typeof check.reason !== 'string' || check.reason.length > 1024))) return false;
    ids.add(check.checkId);
  }
  return true;
}

/** Match declared check identities/actions; verdicts are validated separately. */
export function requiredCheckFailure(manifest, checks = []) {
  const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
  if (!Array.isArray(manifest) || !manifest.length || manifest.length > 256 ||
      manifest.some(item => !item || !validId(item.checkId) || !validId(item.actionId)) ||
      new Set(manifest.map(item => item.checkId)).size !== manifest.length) {
    return { category: 'invalid-required-check-manifest' };
  }
  if (!validCheckOutcomes(checks)) return { category: 'invalid-check-outcomes' };
  const expected = new Map(manifest.map(item => [item.checkId, item.actionId]));
  const observed = new Map(checks.map(item => [item.checkId, item]));
  const missing = manifest.filter(item => !observed.has(item.checkId)).map(item => item.checkId);
  const mismatched = manifest.filter(item => observed.has(item.checkId) &&
    (observed.get(item.checkId).actionId !== item.actionId || !observed.get(item.checkId).required)).map(item => item.checkId);
  const unexpected = checks.filter(item => item.required && !expected.has(item.checkId)).map(item => item.checkId);
  return missing.length || mismatched.length || unexpected.length ?
    { category: 'incomplete-required-checks', missing, mismatched, unexpected } : null;
}

/** Call after browser shutdown, while retaining every event observed until then. */
export function finalizeReplayOutcome(report, expectedSteps) {
  if (expectedSteps !== undefined) {
    const requiredActions = Array.isArray(expectedSteps) ? expectedSteps : null;
    if (requiredActions) {
      if (!requiredActions.length || requiredActions.some(id => typeof id !== 'string' || !id.trim()) || new Set(requiredActions).size !== requiredActions.length) {
        throw new RangeError('Required action manifest must contain unique nonempty action IDs.');
      }
      report.requiredActions = [...requiredActions];
      expectedSteps = requiredActions.length;
    }
    if (!Number.isSafeInteger(expectedSteps) || expectedSteps < 1) {
      throw new RangeError('Expected action count must be a positive safe integer.');
    }
    const steps = report.steps;
    const complete = Array.isArray(steps) && steps.length === expectedSteps &&
      steps.every((step, index) => step?.status === 'pass' && (!requiredActions || step.actionId === requiredActions[index]));
    if (!complete && report.status === 'pass') {
      report.status = 'fail';
      report.completionFailure = {
        category: 'incomplete-required-actions',
        expectedSteps,
        ...(requiredActions ? { expectedActions: [...requiredActions], observedActions: Array.isArray(steps) ? steps.map(step => step?.actionId ?? null) : null } : {}),
        observedSteps: Array.isArray(steps) ? steps.length : null,
        passedSteps: Array.isArray(steps) ? steps.filter(step => step?.status === 'pass').length : 0,
      };
    }
  }
  if (report.checks !== undefined) {
    if (!validCheckOutcomes(report.checks)) {
      report.status = 'fail';
      report.checkFailure ??= { category: 'invalid-check-outcomes', reason: 'Expected up to 256 uniquely identified checks with known statuses, explicit required flags and reasons for every non-pass.' };
    } else {
      // Executed failures dominate missing evidence. Optional omissions never become passes.
      const check = report.checks.find(item => item.status === 'fail') ??
        report.checks.find(item => item.required && item.status === 'blocked') ??
        report.checks.find(item => item.required && item.status !== 'pass');
      if (check) {
        report.checkFailure ??= { category: 'unsatisfied-check', checkId: check.checkId, status: check.status, reason: check.reason };
        if (check.status === 'fail') report.status = 'fail';
        else if (report.status === 'pass') report.status = check.status === 'blocked' ? 'blocked' : 'inconclusive';
      }
    }
  }
  if (report.requiredChecks !== undefined) {
    const failure = requiredCheckFailure(report.requiredChecks, report.checks);
    if (failure) {
      report.checkCompletionFailure ??= failure;
      if (report.status === 'pass') report.status = 'fail';
    }
  }
  const pageErrors = report.errors.length;
  const droppedErrors = report.droppedErrors ?? 0;
  const transport = report.browserFailure?.category ?? null;
  if (pageErrors > 0 || droppedErrors > 0 || transport) {
    report.status = 'fail';
    // Preserve any original operation/cleanup failure separately.
    report.observationFailure = {
      category: transport ?? 'browser-observation-error',
      pageErrors,
      droppedErrors,
      scope: 'events-observed-through-browser-shutdown',
    };
  }
  return report.status === 'pass';
}

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

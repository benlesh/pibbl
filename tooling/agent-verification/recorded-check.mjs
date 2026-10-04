import { describeReplayError } from './failure-evidence.mjs';

/** Run a harness-owned assertion; records are evidence, never application instructions. */
export async function recordAssertion(report, { checkId, actionId }, assertion) {
  const validId = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
  if (!validId(checkId) || !validId(actionId) || typeof assertion !== 'function') throw new TypeError('A check requires bounded check/action IDs and an assertion function.');
  if (report.steps?.filter(step => step.actionId === actionId).length !== 1) throw new RangeError('Check action identity is missing or ambiguous.');
  report.checks ??= [];
  if (!Array.isArray(report.checks) || report.checks.length >= 256) throw new RangeError('Recorded check capacity exhausted.');
  if (report.checks.some(check => check.checkId === checkId)) throw new RangeError('Duplicate recorded check identity.');
  const index = report.checks.length;
  const base = { checkId, actionId, required: true };
  report.checks.push(Object.freeze({ ...base, status: 'blocked', reason: 'Assertion has not completed.' }));
  try {
    const value = await assertion();
    report.checks[index] = Object.freeze({ ...base, status: 'pass', reason: null });
    return value;
  } catch (error) {
    const failure = describeReplayError(error);
    report.checks[index] = Object.freeze({ ...base, status: 'fail', reason: failure.message || 'Assertion threw without a message.', failure });
    report.firstFailedCheck ??= Object.freeze({ checkId, actionId });
    throw error;
  }
}

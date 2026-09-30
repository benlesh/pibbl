import { AssertionError } from 'node:assert';

/** Absolute, exclusive tolerance; invalid/nonfinite actual values always fail. */
export function assertNear(actual, expected, tolerance, { quantity, units }) {
  if (!Number.isFinite(expected) || !Number.isFinite(tolerance) || tolerance <= 0) {
    throw new RangeError('Numeric oracle requires a finite expected value and positive finite tolerance.');
  }
  const difference = Math.abs(actual - expected);
  if (Number.isFinite(actual) && difference < tolerance) return;
  const error = new AssertionError({
    actual, expected, operator: 'absolute-error < tolerance',
    message: `${quantity} (${units}) exceeded its exclusive absolute tolerance.`,
    stackStartFn: assertNear,
  });
  error.comparison = { quantity, units, tolerance, difference, boundary: 'exclusive' };
  throw error;
}

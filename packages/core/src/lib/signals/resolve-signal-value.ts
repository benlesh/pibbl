import {
  isSignal,
  recordPlainInputResolution,
  recordSignalInputResolution,
} from './graph.js';
import type { SignalValue } from './types.js';

/**
 * Returns a literal input unchanged or reads its current value when it is a Pibbl signal.
 *
 * @param value - Literal value or signal to read. See {@link SignalValue}.
 * @returns The literal value, or the signal's current value.
 *
 * @see {@link SignalValue}
 */
export function resolveSignalValue<T>(value: SignalValue<T>): T {
  if (isSignal(value)) {
    recordSignalInputResolution();
    return value.get() as T;
  }
  recordPlainInputResolution();
  return value;
}

import {
  isSignal,
  recordPlainInputResolution,
  recordSignalInputResolution,
} from './graph.js';
import type { SignalValue } from './types.js';

export function resolveSignalValue<T>(value: SignalValue<T>): T {
  if (isSignal(value)) {
    recordSignalInputResolution();
    return value.get() as T;
  }
  recordPlainInputResolution();
  return value;
}

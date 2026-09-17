import { signal } from '../signals/graph.js';
import type { SignalOptions, WritableSignal } from '../signals/types.js';
import { useHookSlot } from './hook-slot.js';

/** Creates one component-owned writable signal identity for a hook slot. */
export function useSignal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T> {
  return useHookSlot(
    'signal',
    () => signal(initialValue, options),
  ).value;
}

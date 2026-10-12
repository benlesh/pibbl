import { signal } from '../signals/graph.js';
import type { SignalOptions, WritableSignal } from '../signals/types.js';
import { useHookSlot } from './hook-slot.js';

/**
 * Creates one component-owned writable signal identity for a hook slot.
 *
 * @param initialValue - Value stored when this hook slot is first created.
 * @param options - Equality comparison and optional diagnostic name. See {@link SignalOptions}.
 * @returns A stable mount-owned writable signal. See {@link WritableSignal}.
 *
 * @see {@link SignalOptions}
 * @see {@link WritableSignal}
 */
export function useSignal<T>(
  initialValue: T,
  options?: SignalOptions<T>,
): WritableSignal<T> {
  return useHookSlot(
    'signal',
    () => signal(initialValue, options),
  ).value;
}

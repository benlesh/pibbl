import { useHookSlot } from './hook-slot.js';

/**
 * A stable mutable container whose current value does not itself schedule rendering.
 *
 * @see {@link useRef}
 */
export interface PibblRef<T> {
  /** Mutable value retained by the ref container. See {@link PibblRef}. */
  current: T | undefined;
}

/**
 * Hook: Creates a reference object, similar to React's useRef.
 * @param init The initial reference value
 * @returns A reference with a `current` property containing the value
 *
 * @see {@link PibblRef}
 */
export function useRef<T>(init?: T): PibblRef<T> {
  return useHookSlot('ref', () => ({ current: init })).value;
}

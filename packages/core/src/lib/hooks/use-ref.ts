import { useHookSlot } from './hook-slot.js';

/**
 * A stable mutable container whose current value does not itself schedule rendering.
 *
 * @see {@link useRef}
 */
export interface CRCRef<T> {
  /** Mutable value retained by the ref container. See {@link CRCRef}. */
  current: T | undefined;
}

/**
 * Hook: Creates a reference object, similar to React's useRef.
 * @param init The initial reference value
 * @returns A reference with a `current` property containing the value
 *
 * @see {@link CRCRef}
 */
export function useRef<T>(init?: T): CRCRef<T> {
  return useHookSlot('ref', () => ({ current: init })).value;
}

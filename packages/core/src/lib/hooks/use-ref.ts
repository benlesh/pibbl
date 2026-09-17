import { useHookSlot } from './hook-slot.js';

export interface CRCRef<T> {
  current: T | undefined;
}

/**
 * Hook: Creates a reference object, similar to React's useRef.
 * @param init The initial reference value
 * @returns A reference with a `current` property containing the value
 */
export function useRef<T>(init?: T): CRCRef<T> {
  return useHookSlot('ref', () => ({ current: init })).value;
}
